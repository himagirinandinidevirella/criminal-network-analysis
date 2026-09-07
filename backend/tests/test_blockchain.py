"""
Blockchain & cybersecurity layer tests.

These run without any external service: the local-ledger fallback, the
crypto utilities and the cyber-crime detection engine are pure logic.
"""

from __future__ import annotations

from pathlib import Path

from app.services.crypto_service import CryptoService
from app.ml_models.cyber_crime_detector import get_cyber_crime_detector, level_for, color_for


def test_sha256_fingerprint() -> None:
    cs = CryptoService()
    assert cs.calculate_sha256(b"abc") == (
        "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    )
    assert cs.calculate_sha256(b"abc") != cs.calculate_sha256(b"abd")


def test_ip_hash_is_privacy_preserving() -> None:
    cs = CryptoService()
    digest = cs.hash_ip_address("192.168.1.100")
    assert len(digest) == 16
    assert "192.168.1.100" not in digest


def test_sign_and_verify_roundtrip() -> None:
    cs = CryptoService()
    kp = cs.generate_officer_keypair("TEST-BADGE-1")
    signature = cs.generate_digital_signature({"a": 1}, "TEST-BADGE-1")
    assert signature
    # HMAC-fallback signatures verify against the deterministic "public" key.
    if signature.startswith("hmac:"):
        assert cs.verify_digital_signature({"a": 1}, signature, kp["public_key"])
    else:
        assert cs.verify_digital_signature({"a": 1}, signature, kp["public_key"])


def test_encrypt_decrypt_roundtrip() -> None:
    cs = CryptoService()
    enc = cs.encrypt_sensitive_data("evidence-secret", "passphrase")
    assert cs.decrypt_sensitive_data(enc, "passphrase") == "evidence-secret"


def test_local_ledger_evidence_tamper_detection(tmp_path: Path) -> None:
    import app.blockchain.web3_connector as wc

    wc.LEDGER_PATH = Path(tmp_path) / "ledger.json"
    ledger = wc.LocalLedger()

    ledger.evidence_add("ev-1", "hashA", "QmX", "crim-1", "CASE-1", "B1", "DIGITAL", "d")
    assert ledger.evidence_verify("ev-1", "hashA")["verified"] is True
    assert ledger.evidence_verify("ev-1", "hashA")["message"] == "VERIFIED - NOT TAMPERED"
    assert ledger.evidence_verify("ev-1", "hashB")["verified"] is False
    assert ledger.evidence_verify("ev-1", "hashB")["message"] == "TAMPERED - HASH MISMATCH"
    assert ledger.evidence_verify("ev-9", "hashA")["verified"] is False


def test_local_ledger_record_integrity(tmp_path: Path) -> None:
    import app.blockchain.web3_connector as wc

    wc.LEDGER_PATH = Path(tmp_path) / "ledger.json"
    ledger = wc.LocalLedger()

    ledger.record_create("crim-1", "hash1")
    ledger.record_update("crim-1", "RISK", "LOW", "HIGH", "review", "hash2", "B1")
    assert ledger.record_verify("crim-1", "hash2") is True
    assert ledger.record_verify("crim-1", "hash1") is False
    assert len(ledger.record_history("crim-1")) == 1


def test_local_ledger_share_grants(tmp_path: Path) -> None:
    import app.blockchain.web3_connector as wc

    wc.LEDGER_PATH = Path(tmp_path) / "ledger.json"
    ledger = wc.LocalLedger()

    pid = ledger.share_grant("crim-1", "CRIMINAL", "CBI", "STATE_POLICE",
                             "READ_ONLY", 24, "h", "joint op", "B1")
    assert ledger.share_check(pid)["hasAccess"] is True
    ledger.share_revoke(pid, "done")
    assert ledger.share_check(pid)["hasAccess"] is False


def test_cyber_detector_flags_threats() -> None:
    detector = get_cyber_crime_detector()
    result = detector.detect({
        "text": "Ransomware encrypted the files and demanded bitcoin paid to a monero mixer on the dark web .onion site."
    })
    assert result["cyber_risk_score"] > 40
    assert result["categories"]["ransomware"]["detected"] is True
    assert result["categories"]["crypto_laundering"]["detected"] is True
    assert result["categories"]["dark_web"]["detected"] is True


def test_cyber_detector_clean_text() -> None:
    detector = get_cyber_crime_detector()
    result = detector.detect({"text": "Routine family gathering with no suspicious activity."})
    assert result["cyber_risk_score"] == 0.0
    assert result["detected_threats"] == []


def test_cyber_level_banding() -> None:
    assert level_for(90) == "CRITICAL"
    assert level_for(70) == "HIGH"
    assert level_for(45) == "MEDIUM"
    assert level_for(5) == "LOW"
    assert color_for("CRITICAL") == "#EF4444"
    assert color_for("LOW") == "#10B981"
