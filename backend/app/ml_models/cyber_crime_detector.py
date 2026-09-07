"""
CyberCrime Detection Engine.

Detects six categories of cyber-criminal activity from evidence text and
criminal attributes:

    RANSOMWARE, PHISHING, CRYPTO_LAUNDERING, DARK_WEB,
    COORDINATED_ATTACK, SOCIAL_ENGINEERING

and computes an overall 0–100 cyber risk score with the same banding as the
criminal risk engine (LOW / MEDIUM / HIGH / CRITICAL).

The deterministic weighted signal engine always runs. When a trained
scikit-learn classifier exists on disk it is blended in; otherwise the rule
engine alone is used. No heavy dependencies are required to import this module.
"""

from __future__ import annotations

import json
import logging
import re
from pathlib import Path
from typing import Any, Optional

from app.config import settings

logger = logging.getLogger("crimenet.cyber")

# ── Category definitions ──────────────────────────────────────────────────────
# Each category has a weight (contribution to the overall cyber risk score)
# and a set of indicator tokens matched against evidence text.
CATEGORIES: dict[str, dict[str, Any]] = {
    "RANSOMWARE": {
        "label": "Ransomware",
        "weight": 18.0,
        "indicators": [
            "ransomware", "ransom note", "ransom demand", "encrypt", "encrypted",
            "decrypt", "decryptor", "decryption key", "locker", "file locker",
            "cryptolocker", "wannacry", "lockbit", "conti", "revil", "double extortion",
            "data exfiltration", "payload", "malware", "trojan", "botnet",
            "command and control", "c2 server", "c&c", "exploit kit", "zero-day",
        ],
    },
    "PHISHING": {
        "label": "Phishing",
        "weight": 13.0,
        "indicators": [
            "phishing", "spear phishing", "spoofed email", "spoofing", "fake login",
            "credential theft", "credential harvesting", "stolen credentials",
            "lookalike domain", "typosquat", "clone site", "clone website",
            "otp fraud", "otp scam", "smishing", "vishing", "email scam",
            "password reset scam", "bank fraud email", "malicious link", "fake invoice",
        ],
    },
    "CRYPTO_LAUNDERING": {
        "label": "Crypto Laundering",
        "weight": 16.0,
        "indicators": [
            "cryptocurrency", "crypto", "bitcoin", "btc", "ethereum", "eth",
            "monero", "xmr", "tether", "usdt", "wallet", "cold wallet", "hot wallet",
            "mixer", "tumbler", "mixing service", "laundering", "money laundering",
            "layering", "smurfing", "privacy coin", "defi", "nft wash", "wash trading",
            "unhosted wallet", "peer-to-peer exchange", "p2p exchange", "crypto exchange",
            "chain hopping", "chain hopping", "offshore exchange",
        ],
    },
    "DARK_WEB": {
        "label": "Dark Web",
        "weight": 14.0,
        "indicators": [
            "dark web", "darknet", "dark net", "tor", "tor network", "onion",
            ".onion", "hidden service", "deep web", "silk road", "dark market",
            "darknet market", "escrow", "anonymous marketplace", "i2p", "tumblr market",
        ],
    },
    "COORDINATED_ATTACK": {
        "label": "Coordinated Attack",
        "weight": 12.0,
        "indicators": [
            "coordinated", "orchestrated", "ddos", "distributed denial", "dos attack",
            "botnet", "smurf attack", "syn flood", "advanced persistent threat", "apt",
            "supply chain attack", "watering hole", "reconnaissance", "intrusion",
            "data breach", "breach", "exfiltration", "network intrusion", "lateral movement",
        ],
    },
    "SOCIAL_ENGINEERING": {
        "label": "Social Engineering",
        "weight": 11.0,
        "indicators": [
            "social engineering", "pretexting", "baiting", "tailgating",
            "impersonation", "impersonate", "ceo fraud", "business email compromise",
            "bec", "romance scam", "confidence trick", "psychological manipulation",
            "insider threat", "recruitment", "honey trap", "blackmail", "sextortion",
        ],
    },
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

_WORD = re.compile(r"[a-z0-9][a-z0-9 .\-+&@#]{1,60}", re.IGNORECASE)


def level_for(score: float) -> str:
    """Map a numeric score to a cyber-risk level."""
    for low, high, name in LEVELS:
        if low <= score <= high:
            return name
    return "LOW"


def color_for(level: str) -> str:
    """Return the hex colour for a level."""
    return LEVEL_COLORS.get(level, "#10B981")


class CyberCrimeDetector:
    """Detect cyber-crime signals and score cyber risk."""

    def __init__(self) -> None:
        self._model: Optional[Any] = None
        self._model_path = Path(settings.cyber_model_path) if hasattr(settings, "cyber_model_path") else None
        self._vectorizer = None
        self._load_classifier()

    # ── Optional classifier ───────────────────────────────────────────────────
    def _load_classifier(self) -> None:
        try:
            if not self._model_path or not self._model_path.exists():
                return
            import joblib  # noqa: PLC0415

            bundle = joblib.load(str(self._model_path))
            if isinstance(bundle, dict):
                self._model = bundle.get("model")
                self._vectorizer = bundle.get("vectorizer")
            else:
                self._model = bundle
            logger.info("Cyber-crime classifier loaded from %s", self._model_path)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Cyber-crime classifier unavailable (%s); rules only", exc)

    def has_model(self) -> bool:
        return self._model is not None

    # ── Text scanning ─────────────────────────────────────────────────────────
    def scan_text(self, text: str) -> list[str]:
        """Return all matched indicator tokens for the given evidence text."""
        if not text:
            return []
        lowered = text.lower()
        found: list[str] = []
        for spec in CATEGORIES.values():
            for token in spec["indicators"]:
                if token in lowered:
                    found.append(token)
        # De-duplicate while preserving order.
        seen: set[str] = set()
        unique: list[str] = []
        for f in found:
            if f not in seen:
                seen.add(f)
                unique.append(f)
        return unique

    # ── Feature extraction ────────────────────────────────────────────────────
    def extract_features(self, evidence: dict[str, Any]) -> dict[str, float]:
        """
        Normalise an evidence bundle into per-category signal intensities
        (0..1). Accepts `text`, `crime_types`, `accounts`, `description`
        and optional pre-computed flags.
        """
        text = " ".join(
            str(x)
            for x in [
                evidence.get("text"),
                evidence.get("description"),
                evidence.get("narrative"),
                evidence.get("fir_text"),
                " ".join(map(str, evidence.get("crime_types") or [])),
                " ".join(map(str, evidence.get("cyber_flags") or [])),
            ]
            if x
        )
        indicators = self.scan_text(text)
        feats: dict[str, float] = {}
        for key, spec in CATEGORIES.items():
            hits = sum(1 for token in spec["indicators"] if token in text.lower())
            # Density-scaled intensity, capped at 1.0.
            feats[key] = min(1.0, hits / 3.0 + (0.15 if hits else 0.0))
        # Direct flags supplied by the caller add confidence.
        flags = [str(f).upper() for f in (evidence.get("cyber_flags") or [])]
        for key in CATEGORIES:
            if key in flags or CATEGORIES[key]["label"].upper() in flags:
                feats[key] = max(feats[key], 0.9)
        return feats

    # ── Detection ─────────────────────────────────────────────────────────────
    def detect(self, evidence: dict[str, Any]) -> dict[str, Any]:
        """Detect cyber-crime categories and compute the cyber risk score."""
        feats = self.extract_features(evidence)
        text = " ".join(
            str(x)
            for x in [
                evidence.get("text"),
                evidence.get("description"),
                evidence.get("narrative"),
                evidence.get("fir_text"),
                " ".join(map(str, evidence.get("crime_types") or [])),
            ]
            if x
        )
        indicators = self.scan_text(text)

        categories: dict[str, Any] = {}
        weighted_sum = 0.0
        for key, spec in CATEGORIES.items():
            category_hits = [t for t in indicators if t in spec["indicators"]]
            score = round(feats[key] * 100, 1)
            categories[key.lower()] = {
                "label": spec["label"],
                "detected": bool(category_hits) or feats[key] >= 0.9,
                "score": score,
                "confidence": round(min(1.0, len(category_hits) / 3.0), 2),
                "indicator_count": len(category_hits),
                "indicators": category_hits[:8],
            }
            weighted_sum += score * spec["weight"]

        # Blend with the classifier when available.
        ml_score: Optional[float] = None
        if self._model is not None:
            try:
                vector = self._vectorizer.transform([text]) if self._vectorizer else None
                proba = self._model.predict_proba(vector)[0] if vector is not None else None
                ml_score = round(float(max(proba)) * 100, 1) if proba is not None else None
            except Exception as exc:  # noqa: BLE001
                logger.debug("Classifier scoring failed: %s", exc)

        total_weight = sum(spec["weight"] for spec in CATEGORIES.values())
        rule_score = weighted_sum / total_weight
        cyber_score = round((rule_score + (ml_score if ml_score is not None else rule_score)) / 2, 1)
        cyber_score = max(0.0, min(100.0, cyber_score))
        level = level_for(cyber_score)

        detected = [c for c in categories.values() if c["detected"]]
        detected.sort(key=lambda c: -c["score"])
        return {
            "cyber_risk_score": cyber_score,
            "cyber_risk_level": level,
            "color": color_for(level),
            "categories": categories,
            "detected_threats": detected,
            "indicators": indicators,
            "summary": self._summary(cyber_score, detected),
            "recommendations": self._recommendations(cyber_score, detected),
            "engine": "classifier+rules" if ml_score is not None else "rules",
        }

    # ── Criminal-level assessment ─────────────────────────────────────────────
    def assess_criminal(self, criminal: dict[str, Any]) -> dict[str, Any]:
        """Assess a criminal record (as returned by the graph) for cyber threats."""
        evidence = {
            "text": " ".join(
                str(x)
                for x in [
                    criminal.get("description"),
                    criminal.get("notes"),
                    criminal.get("modus_operandi"),
                ]
                if x
            ),
            "crime_types": criminal.get("crime_types") or [],
            "cyber_flags": criminal.get("cyber_flags") or [],
        }
        result = self.detect(evidence)
        result["criminal_id"] = criminal.get("id")
        result["name"] = criminal.get("name")
        return result

    # ── Narrative helpers ─────────────────────────────────────────────────────
    @staticmethod
    def _summary(score: float, detected: list[dict[str, Any]]) -> str:
        if not detected:
            return "No cyber-crime indicators detected in the provided evidence."
        top = detected[0]["label"]
        if score >= 81:
            return f"CRITICAL cyber threat: strong {top} indicators and a cyber risk score of {score}/100."
        if score >= 61:
            return f"HIGH cyber threat: {top} signals dominate with a cyber risk score of {score}/100."
        return f"ELEVATED cyber risk ({score}/100): {top} indicators warrant monitoring."

    @staticmethod
    def _recommendations(score: float, detected: list[dict[str, Any]]) -> list[str]:
        recs: list[str] = []
        for threat in detected[:3]:
            label = threat["label"]
            if label == "Ransomware":
                recs.append("Isolate affected systems; preserve encrypted samples and ransom notes.")
            elif label == "Phishing":
                recs.append("Trace spoofed domains and sender infrastructure; notify target institutions.")
            elif label == "Crypto Laundering":
                recs.append("Submit wallet addresses to blockchain forensics; trace mixer/tumbler flows.")
            elif label == "Dark Web":
                recs.append("Initiate TOR de-anonymization workflow; monitor hidden markets for the subject.")
            elif label == "Coordinated Attack":
                recs.append("Correlate with CERT-In advisories; map C2 infrastructure and attack windows.")
            elif label == "Social Engineering":
                recs.append("Interview victims; collect call/email metadata for attribution.")
        if score >= 81:
            recs.append("Escalate to the cyber-crime cell and freeze linked financial accounts.")
        elif not recs:
            recs.append("Continue periodic monitoring; re-run detection on new evidence.")
        return recs

    # ── Training (used when a labelled corpus is available) ───────────────────
    def train_classifier(self, texts: list[str], labels: list[str]) -> bool:
        """
        Train and persist a TF-IDF + LogisticRegression classifier. Returns
        True on success. Optional — the rule engine does not depend on it.
        """
        try:
            from sklearn.feature_extraction.text import TfidfVectorizer
            from sklearn.linear_model import LogisticRegression
            import joblib  # noqa: PLC0415

            vectorizer = TfidfVectorizer(ngram_range=(1, 2), max_features=5000)
            X = vectorizer.fit_transform(texts)
            model = LogisticRegression(max_iter=1000)
            model.fit(X, labels)
            path = self._model_path or Path("backend/data/models/cyber_crime_clf.joblib")
            path.parent.mkdir(parents=True, exist_ok=True)
            joblib.dump({"model": model, "vectorizer": vectorizer}, str(path))
            self._model = model
            self._vectorizer = vectorizer
            logger.info("Cyber-crime classifier trained and saved to %s", path)
            return True
        except Exception as exc:  # noqa: BLE001
            logger.warning("Cyber-crime classifier training skipped: %s", exc)
            return False


# ── Module-level singleton ────────────────────────────────────────────────────
_detector: Optional[CyberCrimeDetector] = None


def get_cyber_crime_detector() -> CyberCrimeDetector:
    """Return the shared cyber-crime detector."""
    global _detector
    if _detector is None:
        _detector = CyberCrimeDetector()
    return _detector
