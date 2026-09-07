"""
AuditChain — immutable audit trail on the blockchain.

Every action (VIEW/EDIT/EXPORT/SHARE/DELETE/LOGIN/SEARCH) is also recorded
on-chain with a privacy-preserving IP hash, giving the court a tamper-proof
history that even administrators cannot delete.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from app.blockchain.web3_connector import get_web3_connector
from app.services.crypto_service import get_crypto_service

logger = logging.getLogger("crimenet.audit_chain")


def _fmt_ts(ts: int) -> str:
    if not ts:
        return ""
    return datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


class AuditChain:
    """Records and reads the immutable audit ledger."""

    def __init__(self) -> None:
        self.connector = get_web3_connector()
        self.crypto = get_crypto_service()

    async def log_action(
        self,
        officer_badge_id: str,
        department: str,
        action: str,
        target_id: str,
        target_type: str,
        ip_address: str,
        result: str,
        data_accessed: dict[str, Any],
    ) -> dict[str, Any]:
        """Append one action to the immutable ledger."""
        ip_hash = self.crypto.hash_ip_address(ip_address or "unknown")
        data_hash = self.crypto.hash_data_dict(data_accessed or {})
        session_hash = "0x" + uuid.uuid4().hex + uuid.uuid4().hex  # 64 hex chars

        tx = self.connector.backend.audit_log(
            officer_badge_id or "system",
            department or "UNKNOWN",
            action,
            target_id or "global",
            target_type or "GENERAL",
            ip_hash,
            result or "SUCCESS",
            data_hash,
            session_hash,
        )
        return {
            "success": True,
            "transaction_hash": tx.get("transaction_hash"),
            "block_number": tx.get("block_number"),
            "action": action,
            "target_id": target_id,
        }

    async def get_audit_trail(self, target_id: str) -> list[dict[str, Any]]:
        """Complete immutable history for a target (court exhibit)."""
        records = self.connector.backend.audit_by_target(target_id)
        return [self._decorate(r) for r in records]

    async def get_officer_activity(self, officer_badge: str) -> list[dict[str, Any]]:
        """All actions ever taken by an officer."""
        records = self.connector.backend.audit_by_officer(officer_badge)
        return [self._decorate(r) for r in records]

    async def get_suspicious_activity(self) -> list[dict[str, Any]]:
        """Recent suspicious-activity signals from the ledger."""
        # Unauthorized accesses and high-frequency views are suspicious.
        records = self.connector.backend.audit_by_target("global")
        suspicious = [
            self._decorate(r)
            for r in records
            if r.get("result") == "UNAUTHORIZED"
        ]
        return suspicious[-20:]

    @staticmethod
    def _decorate(record: dict[str, Any]) -> dict[str, Any]:
        return {
            "logId": record.get("logId"),
            "officerBadgeId": record.get("officerBadgeId"),
            "officerDepartment": record.get("officerDepartment"),
            "action": record.get("action"),
            "targetId": record.get("targetId"),
            "targetType": record.get("targetType"),
            "timestamp": record.get("timestamp"),
            "formattedTimestamp": _fmt_ts(record.get("timestamp") or 0),
            "ipHash": record.get("ipAddress"),
            "result": record.get("result"),
        }
