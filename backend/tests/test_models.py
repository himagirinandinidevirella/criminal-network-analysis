"""
Model and pure-logic tests.

These do not require any external database — they validate the risk scoring
banding, NLP cleaning/deduplication and anomaly rule engines.
"""

from __future__ import annotations

from app.ml_models.risk_scorer import color_for, level_for


def test_risk_levels() -> None:
    """Risk band edges map to the correct levels."""
    assert level_for(95) == "CRITICAL"
    assert level_for(81) == "CRITICAL"
    assert level_for(70) == "HIGH"
    assert level_for(45) == "MEDIUM"
    assert level_for(10) == "LOW"
    assert level_for(0) == "LOW"


def test_risk_colors() -> None:
    """Risk levels map to the specified brand colours."""
    assert color_for("CRITICAL") == "#EF4444"
    assert color_for("HIGH") == "#F97316"
    assert color_for("MEDIUM") == "#F59E0B"
    assert color_for("LOW") == "#10B981"


def test_nlp_clean() -> None:
    """HTML is stripped and whitespace collapsed."""
    from app.ml_models.nlp_extractor import NLPEntityExtractor

    extractor = NLPEntityExtractor.__new__(NLPEntityExtractor)
    cleaned = extractor._clean("<p>Hello   <b>World</b></p> Rs. 50")
    assert "<" not in cleaned
    assert "₹" in cleaned


def test_nlp_regex_vehicle() -> None:
    """Vehicle registration numbers are extracted."""
    from app.ml_models.nlp_extractor import NLPEntityExtractor

    extractor = NLPEntityExtractor.__new__(NLPEntityExtractor)
    entities = extractor._extract_regex("The car MH-01-AX-9999 was seized.")
    assert any(e.type == "VEHICLE" and e.text == "MH-01-AX-9999" for e in entities)


def test_anomaly_round_numbers() -> None:
    """Round-number financial amounts are flagged."""
    from app.ml_models.anomaly_detector import AnomalyDetector

    detector = AnomalyDetector.__new__(AnomalyDetector)
    detector._isolation_forest = None
    txns = [
        {"amount": 1000000, "type": "TRANSFER", "date": "2024-08-18T14:00:00"},
        {"amount": 1000000, "type": "TRANSFER", "date": "2024-08-18T14:00:00"},
        {"amount": 1000000, "type": "TRANSFER", "date": "2024-08-18T14:00:00"},
        {"amount": 1000000, "type": "TRANSFER", "date": "2024-08-18T14:00:00"},
        {"amount": 1000000, "type": "TRANSFER", "date": "2024-08-18T14:00:00"},
        {"amount": 1000000, "type": "TRANSFER", "date": "2024-08-18T14:00:00"},
        {"amount": 1000000, "type": "TRANSFER", "date": "2024-08-18T14:00:00"},
        {"amount": 1000000, "type": "TRANSFER", "date": "2024-08-18T14:00:00"},
        {"amount": 1000000, "type": "TRANSFER", "date": "2024-08-18T14:00:00"},
        {"amount": 1000000, "type": "TRANSFER", "date": "2024-08-18T14:00:00"},
    ]
    anomalies = detector.detect_financial(txns)
    assert any("round_number_amount" in a["reasons"] for a in anomalies)
