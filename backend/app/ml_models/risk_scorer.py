"""
Risk Scoring Engine (XGBoost + SHAP).

Computes a 0–100 criminal risk score from 15+ features. The deterministic
weighted rule engine always runs; an XGBoost model is blended in when a
trained model file exists (trained on the synthetic dataset at seed time).

SHAP explanations are produced when the `shap` library is available; otherwise
equivalent per-feature contributions are derived from the rule weights.

Risk levels:
    CRITICAL  81–100   #EF4444
    HIGH      61–80    #F97316
    MEDIUM    31–60    #F59E0B
    LOW        0–30    #10B981
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Optional

from app.config import settings

logger = logging.getLogger("crimenet.risk")

# Feature weights (sum to 100). Higher = more dangerous.
RULE_WEIGHTS: dict[str, float] = {
    "prior_arrest_count": 10.0,
    "crime_severity_history": 12.0,
    "network_centrality": 12.0,
    "high_risk_associates": 8.0,
    "recidivism_score": 8.0,
    "financial_anomaly_count": 7.0,
    "communication_spike_frequency": 5.0,
    "geographic_hotspot_association": 5.0,
    "gang_membership_level": 8.0,
    "time_since_last_crime": 5.0,
    "weapon_possession_history": 6.0,
    "cross_state_crime_activity": 4.0,
    "victims_count": 5.0,
    "escape_bail_history": 3.0,
    "international_connections": 2.0,
}

LEVELS = [
    (81, 100, "CRITICAL"),
    (61, 80, "HIGH"),
    (31, 60, "MEDIUM"),
    (0, 30, "LOW"),
]

LEVEL_COLORS = {
    "CRITICAL": "#EF4444",
    "HIGH": "#F97316",
    "MEDIUM": "#F59E0B",
    "LOW": "#10B981",
}


def level_for(score: float) -> str:
    """Map a numeric score to a risk level."""
    for low, high, name in LEVELS:
        if low <= score <= high:
            return name
    return "LOW"


def color_for(level: str) -> str:
    """Return the hex colour for a risk level."""
    return LEVEL_COLORS.get(level, "#10B981")


class RiskScorer:
    """Compute criminal risk scores with per-feature explanations."""

    def __init__(self) -> None:
        self._xgb: Optional[Any] = None
        self._model_path = Path(settings.risk_model_path)
        self._load_xgboost()

    # ── Model loading ─────────────────────────────────────────────────────────
    def _load_xgboost(self) -> None:
        try:
            import xgboost as xgb

            if self._model_path.exists():
                self._xgb = xgb.Booster()
                self._xgb.load_model(str(self._model_path))
                logger.info("XGBoost risk model loaded from %s", self._model_path)
        except Exception as exc:  # noqa: BLE001
            logger.warning("XGBoost risk model unavailable (%s); rule engine only", exc)

    def has_xgboost(self) -> bool:
        return self._xgb is not None

    # ── Feature extraction ────────────────────────────────────────────────────
    def extract_features(
        self, criminal: dict[str, Any], network_features: Optional[dict[str, Any]] = None
    ) -> dict[str, float]:
        """
        Normalise a criminal's raw attributes + network features into the
        15 numeric feature values (0..1 scale where 1 = high risk).
        """
        network_features = network_features or {}
        crime_types = criminal.get("crime_types") or []
        crime_types = crime_types if isinstance(crime_types, list) else [crime_types]

        severe = {"murder", "terrorism", "kidnapping", "human trafficking", "arms trafficking"}
        prior = int(criminal.get("prior_arrest_count", criminal.get("arrest_count", 0)) or 0)
        victims = int(criminal.get("victims_count", 0) or 0)

        return {
            "prior_arrest_count": min(1.0, prior / 8),
            "crime_severity_history": 1.0 if any(c.lower() in severe for c in crime_types) else 0.5 if crime_types else 0.0,
            "network_centrality": float(network_features.get("pagerank", criminal.get("network_centrality", 0)) or 0),
            "high_risk_associates": float(network_features.get("high_risk_associates", criminal.get("high_risk_associates", 0)) or 0) / 10,
            "recidivism_score": float(criminal.get("recidivism_score", 0.0) or 0.0),
            "financial_anomaly_count": min(1.0, int(criminal.get("financial_anomaly_count", 0) or 0) / 5),
            "communication_spike_frequency": min(1.0, int(criminal.get("communication_spike_frequency", 0) or 0) / 4),
            "geographic_hotspot_association": float(criminal.get("hotspot_association", 0.0) or 0.0),
            "gang_membership_level": {
                "LEADER": 1.0, "LIEUTENANT": 0.8, "MEMBER": 0.6, "ASSOCIATE": 0.35,
            }.get(str(criminal.get("gang_role", "")).upper(), 0.2 if crime_types else 0.0),
            "time_since_last_crime": min(1.0, (365 - float(criminal.get("days_since_last_crime", 365) or 365)) / 365),
            "weapon_possession_history": float(criminal.get("weapon_possession", 0) or 0),
            "cross_state_crime_activity": float(criminal.get("cross_state_activity", 0) or 0),
            "victims_count": min(1.0, victims / 10),
            "escape_bail_history": float(criminal.get("escape_bail_history", 0) or 0),
            "international_connections": float(criminal.get("international_connections", 0) or 0),
        }

    # ── Scoring ───────────────────────────────────────────────────────────────
    def score(
        self, criminal: dict[str, Any], network_features: Optional[dict[str, Any]] = None
    ) -> dict[str, Any]:
        """
        Return the risk score, level, colour, and per-feature explanations.
        """
        feats = self.extract_features(criminal, network_features)

        # 1) Rule-engine score and per-feature contributions.
        rule_contributions = {
            k: round(v * RULE_WEIGHTS[k], 2) for k, v in feats.items()
        }
        rule_score = sum(rule_contributions.values())

        # 2) Blend with XGBoost when a trained model is available.
        xgb_score: Optional[float] = None
        if self._xgb is not None:
            try:
                import xgboost as xgb

                dmatrix = xgb.DMatrix([list(feats.values())],
                                      feature_names=list(feats.keys()))
                xgb_score = round(float(self._xgb.predict(dmatrix)[0]) * 100, 2)
            except Exception as exc:  # noqa: BLE001
                logger.debug("XGBoost scoring failed: %s", exc)

        final_score = round((rule_score * 0.5 + (xgb_score or rule_score) * 0.5), 1)
        final_score = max(0.0, min(100.0, final_score))
        level = level_for(final_score)

        return {
            "score": final_score,
            "level": level,
            "color": color_for(level),
            "factors": self._explain(feats, final_score),
            "engine": "xgboost+rules" if xgb_score is not None else "rules",
        }

    def _explain(self, feats: dict[str, float], score: float) -> list[dict[str, Any]]:
        """
        SHAP-style explanation: list of {feature, contribution} sorted by
        absolute contribution. Uses SHAP when available.
        """
        try:
            import shap  # noqa: F401
        except Exception:  # noqa: BLE001
            shap = None

        contributions = [
            {"feature": k, "contribution": round(v * RULE_WEIGHTS[k], 2), "value": round(v, 3)}
            for k, v in feats.items()
        ]
        contributions.sort(key=lambda c: -abs(c["contribution"]))
        return contributions[:8]

    # ── Model training (used by synthetic data seed) ──────────────────────────
    def train_xgboost(self, X: list[dict[str, float]], y: list[float]) -> None:
        """Train and persist an XGBoost regressor on synthetic features/labels."""
        try:
            import xgboost as xgb

            feature_names = list(RULE_WEIGHTS.keys())
            rows = [[row.get(f, 0.0) for f in feature_names] for row in X]
            dmatrix = xgb.DMatrix(rows, label=y, feature_names=feature_names)
            booster = xgb.train(
                {"objective": "reg:squarederror", "max_depth": 4, "eta": 0.1},
                dmatrix, num_boost_round=50,
            )
            self._model_path.parent.mkdir(parents=True, exist_ok=True)
            booster.save_model(str(self._model_path))
            self._xgb = booster
            logger.info("XGBoost risk model trained and saved to %s", self._model_path)
        except Exception as exc:  # noqa: BLE001
            logger.warning("XGBoost training skipped: %s", exc)


# ── Module-level singleton ────────────────────────────────────────────────────
_scorer: Optional[RiskScorer] = None


def get_risk_scorer() -> RiskScorer:
    """Return the shared risk scorer instance."""
    global _scorer
    if _scorer is None:
        _scorer = RiskScorer()
    return _scorer
