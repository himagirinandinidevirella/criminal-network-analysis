"""
ReportChain — blockchain certificates for generated reports.

Registers the SHA-256 of every generated report on-chain, enabling anyone
(the courts, other agencies) to verify that a report is authentic and has not
been altered since it was produced.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from app.blockchain.web3_connector import get_web3_connector
from app.services.crypto_service import get_crypto_service

logger = logging.getLogger("crimenet.report_chain")


def _fmt_ts(ts: int) -> str:
    if not ts:
        return ""
    return datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


class ReportChain:
    """Registers and verifies report certificates."""

    def __init__(self) -> None:
        self.connector = get_web3_connector()
        self.crypto = get_crypto_service()

    async def register_report(
        self,
        report_id: str,
        report_type: str,
        entity_id: str,
        report_bytes: bytes,
        classification: str,
        officer_badge: str,
    ) -> dict[str, Any]:
        """Store a report fingerprint on-chain; return its certificate."""
        report_hash = self.crypto.calculate_sha256(report_bytes)
        signature = self.crypto.generate_digital_signature(
            {"report_id": report_id, "report_hash": report_hash}, officer_badge or "system"
        )
        try:
            tx = self.connector.backend.report_register(
                report_id, report_type, entity_id, report_hash,
                classification, signature, officer_badge or "system",
            )
        except ValueError as exc:
            logger.debug("Report %s already registered: %s", report_id, exc)
            tx = {"transaction_hash": None, "block_number": None}
        return {
            "success": True,
            "report_id": report_id,
            "report_hash": report_hash,
            "transaction_hash": tx.get("transaction_hash"),
            "block_number": tx.get("block_number"),
            "certificate": {
                "report_id": report_id,
                "classification": classification,
                "report_hash": report_hash,
                "registered_at": _fmt_ts(tx.get("timestamp") or 0),
                "transaction_hash": tx.get("transaction_hash"),
                "network": self.connector.get_network_status().get("network"),
            },
        }

    async def verify_report_authenticity(self, report_id: str, report_bytes: bytes) -> dict[str, Any]:
        """Verify a report file against its on-chain certificate."""
        check_hash = self.crypto.calculate_sha256(report_bytes)
        authentic = self.connector.backend.report_verify(report_id, check_hash)
        record = self.connector.backend.report_get(report_id) or {}
        return {
            "authentic": authentic,
            "generated_at": _fmt_ts(record.get("generatedAt") or 0),
            "generated_by": record.get("officerBadgeId"),
            "classification": record.get("classification"),
            "blockchain_certificate": f"chain://report/{report_id}#{check_hash[:16]}",
            "court_valid": authentic and not record.get("isRevoked", False),
        }

    async def get_report_certificate(self, report_id: str) -> dict[str, Any]:
        """Return the on-chain certificate metadata for a report."""
        record = self.connector.backend.report_get(report_id)
        if not record:
            return {}
        return {
            "reportId": record.get("reportId"),
            "reportType": record.get("reportType"),
            "entityId": record.get("entityId"),
            "reportHash": record.get("reportHash"),
            "generatedAt": _fmt_ts(record.get("generatedAt") or 0),
            "classification": record.get("classification"),
            "isRevoked": record.get("isRevoked"),
            "version": record.get("version"),
        }
