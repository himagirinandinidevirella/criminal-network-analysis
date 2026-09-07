"""
EvidenceChain — evidence integrity on the blockchain.

Uploads evidence to IPFS, registers its SHA-256 fingerprint on-chain, and
verifies files against the immutable record (tamper detection for the court).
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from app.blockchain.web3_connector import get_web3_connector
from app.database.postgres_connection import execute
from app.services.crypto_service import get_crypto_service
from app.services.ipfs_service import get_ipfs_service

logger = logging.getLogger("crimenet.evidence_chain")


def _fmt_ts(ts: int) -> str:
    if not ts:
        return ""
    return datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


class EvidenceChain:
    """Manages the full evidence-on-blockchain lifecycle."""

    def __init__(self) -> None:
        self.connector = get_web3_connector()
        self.crypto = get_crypto_service()
        self.ipfs = get_ipfs_service()

    async def add_evidence_to_blockchain(
        self,
        evidence_id: str,
        file_bytes: bytes,
        ipfs_hash: str,
        criminal_id: str,
        case_number: str,
        evidence_type: str,
        description: str,
        officer_badge_id: str,
    ) -> dict[str, Any]:
        """Hash a file, store the fingerprint on-chain, persist metadata."""
        file_hash = self.crypto.calculate_sha256(file_bytes)

        try:
            tx = self.connector.backend.evidence_add(
                evidence_id, file_hash, ipfs_hash, criminal_id, case_number,
                officer_badge_id, evidence_type, description,
            )
        except ValueError as exc:
            logger.warning("Evidence already on chain (%s): %s", evidence_id, exc)
            tx = {"transaction_hash": None, "block_number": None, "timestamp": 0}

        # Persist the metadata row for quick lookup (never blocks the on-chain
        # record if the relational store is unavailable).
        try:
            execute(
                """
                INSERT INTO evidence (criminal_id, file_url, file_type, uploaded_by, chain_of_custody)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (criminal_id, self.ipfs.get_ipfs_gateway_url(ipfs_hash), evidence_type,
                 officer_badge_id, f"ipfs:{ipfs_hash};blockchain_tx:{tx.get('transaction_hash')}"),
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("Evidence metadata persistence skipped: %s", exc)

        return {
            "success": True,
            "evidence_id": evidence_id,
            "transaction_hash": tx.get("transaction_hash"),
            "block_number": tx.get("block_number"),
            "file_hash": file_hash,
            "ipfs_hash": ipfs_hash,
            "blockchain_timestamp": _fmt_ts(tx.get("timestamp") or 0),
            "gas_used": tx.get("gas_used"),
            "ipfs_gateway_url": self.ipfs.get_ipfs_gateway_url(ipfs_hash),
        }

    async def verify_evidence(self, evidence_id: str, file_bytes: bytes) -> dict[str, Any]:
        """Verify a file against the immutable on-chain fingerprint."""
        check_hash = self.crypto.calculate_sha256(file_bytes)
        result = self.connector.backend.evidence_verify(evidence_id, check_hash)
        record = result.get("record") or {}
        return {
            "verified": result["verified"],
            "message": result["message"],
            "integrity": "INTACT" if result["verified"] else (
                "NOT_FOUND" if "NOT FOUND" in result["message"] else "TAMPERED"
            ),
            "original_timestamp": _fmt_ts(result.get("original_timestamp") or 0),
            "uploaded_by_officer": record.get("officerBadgeId"),
            "court_admissible": bool(record.get("courtAdmissible")),
            "blockchain_proof": self._proof(evidence_id, record),
        }

    async def get_evidence_for_case(self, case_number: str) -> list[dict[str, Any]]:
        """All on-chain evidence records for a case."""
        records = self.connector.backend.evidence_list_by_case(case_number)
        return [self._decorate(r) for r in records]

    async def get_evidence_for_criminal(self, criminal_id: str) -> list[dict[str, Any]]:
        """All on-chain evidence records for a criminal."""
        records = self.connector.backend.evidence_list_by_criminal(criminal_id)
        return [self._decorate(r) for r in records]

    async def mark_court_admissible(self, evidence_id: str, officer_badge: str) -> dict[str, Any]:
        """Mark evidence as court-admissible on-chain."""
        tx = self.connector.backend.evidence_mark_court_admissible(evidence_id)
        return {"success": True, "evidence_id": evidence_id, "officer_badge": officer_badge,
                "transaction_hash": tx.get("transaction_hash")}

    # ── Helpers ───────────────────────────────────────────────────────────────
    def _decorate(self, record: dict[str, Any]) -> dict[str, Any]:
        return {
            "evidenceId": record.get("evidenceId"),
            "fileHash": record.get("fileHash"),
            "ipfsHash": record.get("ipfsHash"),
            "criminalId": record.get("criminalId"),
            "caseNumber": record.get("caseNumber"),
            "officerBadgeId": record.get("officerBadgeId"),
            "timestamp": record.get("timestamp"),
            "formattedTimestamp": _fmt_ts(record.get("timestamp") or 0),
            "evidenceType": record.get("evidenceType"),
            "description": record.get("description"),
            "isValid": record.get("isValid"),
            "courtAdmissible": record.get("courtAdmissible"),
            "ipfsGatewayUrl": self.ipfs.get_ipfs_gateway_url(record.get("ipfsHash") or ""),
        }

    @staticmethod
    def _proof(evidence_id: str, record: dict[str, Any]) -> str:
        """A deterministic proof string pointing at the on-chain record."""
        if record.get("fileHash"):
            return f"chain://evidence/{evidence_id}#{record.get('fileHash', '')[:16]}"
        return f"chain://evidence/{evidence_id}"
