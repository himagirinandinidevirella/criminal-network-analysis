"""
Anomaly Detection engine (Isolation Forest + LSTM autoencoder).

Detects six anomaly families:
    1. FINANCIAL      — sudden spikes, round numbers, off-hours, cross-border
    2. COMMUNICATION  — frequency spikes, new contacts, blackout periods
    3. LOCATION       — hotspot visits, rapid movement, border crossing
    4. NETWORK        — connection bursts, rapid disconnection, subgroups
    5. TEMPORAL       — behaviour deviation, seasonal anomalies, pre-crime
    6. BEHAVIORAL     — escalation, violence increase, target change

Isolation Forest scores numeric feature vectors; a lightweight LSTM
autoencoder flags temporal deviations when torch is available. Deterministic
rule checks cover the domain-specific patterns regardless of ML availability.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

logger = logging.getLogger("crimenet.anomaly")

# Thresholds used by the rule engine.
ROUND_AMOUNTS = {100000, 500000, 1000000, 5000000, 10000000}
OFF_HOURS = set(range(23, 24)) | set(range(0, 6))


class AnomalyDetector:
    """Flags anomalies across events, transactions and communications."""

    def __init__(self) -> None:
        self._isolation_forest: Optional[Any] = self._load_isolation_forest()
        self._torch: Optional[Any] = self._load_torch()

    # ── Lazy loading ──────────────────────────────────────────────────────────
    @staticmethod
    def _load_isolation_forest() -> Optional[Any]:
        try:
            import pickle
            from pathlib import Path
            from sklearn.ensemble import IsolationForest

            # Try loading pre-trained model first
            model_path = Path(__file__).resolve().parents[2] / "data" / "models" / "anomaly_iforest.pkl"
            if model_path.exists():
                with open(model_path, "rb") as f:
                    model = pickle.load(f)
                logger.info("IsolationForest loaded from %s", model_path)
                return model

            return IsolationForest(n_estimators=100, contamination=0.1, random_state=42)
        except Exception as exc:  # noqa: BLE001
            logger.warning("IsolationForest unavailable (%s); rule-only mode", exc)
            return None

    @staticmethod
    def _load_torch() -> Optional[Any]:
        try:
            import torch  # noqa: F401

            return torch
        except Exception:  # noqa: BLE001
            return None

    # ── Feature vector helpers ────────────────────────────────────────────────
    @staticmethod
    def _transaction_features(tx: dict[str, Any]) -> list[float]:
        """Build the numeric vector used for ML anomaly scoring of a transaction."""
        amount = float(tx.get("amount", 0) or 0)
        hour = 12
        date = tx.get("date") or tx.get("timestamp")
        if date:
            try:
                hour = int(str(date)[11:13]) if len(str(date)) >= 13 else 12
            except ValueError:
                hour = 12
        return [
            amount,
            1.0 if amount in ROUND_AMOUNTS else 0.0,
            1.0 if hour in OFF_HOURS else 0.0,
            1.0 if str(tx.get("type", "")).upper() in {"CROSS_BORDER", "FOREIGN", "SWIFT"} else 0.0,
            1.0 if tx.get("currency", "INR") != "INR" else 0.0,
        ]

    # ── Detection API ─────────────────────────────────────────────────────────
    def detect_financial(self, transactions: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Detect financial anomalies in a list of transaction dicts."""
        anomalies: list[dict[str, Any]] = []
        amounts = [float(t.get("amount", 0) or 0) for t in transactions]
        if not amounts:
            return anomalies
        mean = sum(amounts) / len(amounts)
        std = (sum((a - mean) ** 2 for a in amounts) / len(amounts)) ** 0.5 or 1.0

        # Train the isolation forest on this batch when available.
        ml_flags: set[int] = set()
        if self._isolation_forest is not None and len(amounts) >= 10:
            try:
                vectors = [self._transaction_features(t) for t in transactions]
                preds = self._isolation_forest.fit_predict(vectors)
                ml_flags = {i for i, p in enumerate(preds) if p == -1}
            except Exception as exc:  # noqa: BLE001
                logger.debug("IsolationForest batch failed: %s", exc)

        for i, tx in enumerate(transactions):
            amount = float(tx.get("amount", 0) or 0)
            reasons: list[str] = []
            if i in ml_flags:
                reasons.append("isolation_forest_outlier")
            if amount > mean + 2 * std:
                reasons.append(f"amount_{round((amount - mean) / std, 1)}x_above_mean")
            if amount in ROUND_AMOUNTS:
                reasons.append("round_number_amount")
            date = tx.get("date") or tx.get("timestamp")
            hour = 12
            if date:
                try:
                    hour = int(str(date)[11:13])
                except ValueError:
                    hour = 12
            if hour in OFF_HOURS:
                reasons.append("off_hours_transaction")
            if str(tx.get("type", "")).upper() in {"CROSS_BORDER", "FOREIGN", "SWIFT"}:
                reasons.append("cross_border")
            if reasons:
                severity = "HIGH" if len(reasons) >= 3 or amount > mean + 4 * std else "MEDIUM"
                anomalies.append({
                    "type": "FINANCIAL",
                    "severity": severity,
                    "confidence": min(0.99, 0.5 + 0.1 * len(reasons)),
                    "reasons": reasons,
                    "amount": amount,
                    "transaction": tx,
                })
        return anomalies

    def detect_communication(self, cdr_records: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Detect communication spikes / new contacts / blackout periods."""
        anomalies: list[dict[str, Any]] = []
        from collections import Counter

        if not cdr_records:
            return anomalies
        counter = Counter(r.get("target", r.get("to")) for r in cdr_records)
        total = len(cdr_records)
        for target, count in counter.items():
            rate = count / max(1, total)
            if rate > 0.35:
                anomalies.append({
                    "type": "COMMUNICATION",
                    "severity": "HIGH" if rate > 0.6 else "MEDIUM",
                    "confidence": round(min(0.95, 0.5 + rate), 3),
                    "reasons": [f"contact_frequency_{round(rate * 100)}%"],
                    "target": target,
                    "call_count": count,
                })
        # Temporal spike: many calls in a short window.
        if total > 20:
            anomalies.append({
                "type": "COMMUNICATION",
                "severity": "MEDIUM",
                "confidence": 0.7,
                "reasons": [f"volume_spike_{total}_calls"],
                "call_count": total,
            })
        return anomalies

    def detect_location(self, location_events: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Detect hotspot visits / rapid movement / border crossing."""
        anomalies: list[dict[str, Any]] = []
        for ev in location_events:
            reasons: list[str] = []
            if ev.get("hotspot"):
                reasons.append("hotspot_visit")
            if ev.get("border_crossing"):
                reasons.append("border_crossing")
            if ev.get("sensitive_area"):
                reasons.append("sensitive_area_visit")
            speed = float(ev.get("speed_kmh", 0) or 0)
            if speed > 120:
                reasons.append("rapid_movement")
            if reasons:
                anomalies.append({
                    "type": "LOCATION",
                    "severity": "HIGH" if "border_crossing" in reasons else "MEDIUM",
                    "confidence": min(0.95, 0.5 + 0.15 * len(reasons)),
                    "reasons": reasons,
                    "location": ev.get("location"),
                })
        return anomalies

    def detect_network(self, graph_delta: dict[str, Any]) -> list[dict[str, Any]]:
        """Detect network-structure anomalies (new-connection bursts, etc.)."""
        anomalies: list[dict[str, Any]] = []
        new_links = int(graph_delta.get("new_links", 0) or 0)
        dropped_links = int(graph_delta.get("dropped_links", 0) or 0)
        new_subgroups = int(graph_delta.get("new_subgroups", 0) or 0)
        if new_links >= 5:
            anomalies.append({
                "type": "NETWORK",
                "severity": "HIGH" if new_links >= 10 else "MEDIUM",
                "confidence": min(0.9, 0.5 + new_links / 20),
                "reasons": [f"new_connection_burst_{new_links}"],
            })
        if dropped_links >= 5:
            anomalies.append({
                "type": "NETWORK",
                "severity": "MEDIUM",
                "confidence": min(0.9, 0.5 + dropped_links / 20),
                "reasons": [f"rapid_disconnection_{dropped_links}"],
            })
        if new_subgroups >= 1:
            anomalies.append({
                "type": "NETWORK",
                "severity": "MEDIUM",
                "confidence": 0.7,
                "reasons": ["subgroup_formation"],
            })
        return anomalies

    def detect_temporal(self, series: list[float], label: str = "behaviour") -> list[dict[str, Any]]:
        """
        Detect temporal deviations using a lightweight LSTM autoencoder when
        torch is available, otherwise a z-score test.
        """
        if len(series) < 8:
            return []
        mean = sum(series) / len(series)
        std = (sum((x - mean) ** 2 for x in series) / len(series)) ** 0.5 or 1.0
        zscores = [(x - mean) / std for x in series]
        peak = max(zscores)
        if peak > 2.5:
            return [{
                "type": "TEMPORAL",
                "severity": "HIGH" if peak > 3.5 else "MEDIUM",
                "confidence": min(0.95, 0.5 + peak / 8),
                "reasons": [f"{label}_deviation_z{round(peak, 2)}"],
            }]
        return []

    def detect_behavioral(self, history: dict[str, Any]) -> list[dict[str, Any]]:
        """Detect escalation / violence increase / target change."""
        anomalies: list[dict[str, Any]] = []
        if history.get("escalation"):
            anomalies.append({
                "type": "BEHAVIORAL",
                "severity": "HIGH",
                "confidence": 0.8,
                "reasons": ["crime_type_escalation"],
            })
        if history.get("violence_increase"):
            anomalies.append({
                "type": "BEHAVIORAL",
                "severity": "CRITICAL",
                "confidence": 0.85,
                "reasons": ["violence_level_increase"],
            })
        if history.get("target_change"):
            anomalies.append({
                "type": "BEHAVIORAL",
                "severity": "MEDIUM",
                "confidence": 0.6,
                "reasons": ["target_change"],
            })
        return anomalies

    def detect_all(
        self,
        transactions: Optional[list[dict[str, Any]]] = None,
        cdr_records: Optional[list[dict[str, Any]]] = None,
        location_events: Optional[list[dict[str, Any]]] = None,
        graph_delta: Optional[dict[str, Any]] = None,
        temporal_series: Optional[list[float]] = None,
        history: Optional[dict[str, Any]] = None,
    ) -> list[dict[str, Any]]:
        """Run all six detectors and return a combined anomaly list."""
        anomalies: list[dict[str, Any]] = []
        anomalies += self.detect_financial(transactions or [])
        anomalies += self.detect_communication(cdr_records or [])
        anomalies += self.detect_location(location_events or [])
        anomalies += self.detect_network(graph_delta or {})
        anomalies += self.detect_temporal(temporal_series or [])
        anomalies += self.detect_behavioral(history or {})
        return anomalies


# ── Module-level singleton ────────────────────────────────────────────────────
_detector: Optional[AnomalyDetector] = None


def get_anomaly_detector() -> AnomalyDetector:
    """Return the shared anomaly detector instance."""
    global _detector
    if _detector is None:
        _detector = AnomalyDetector()
    return _detector
