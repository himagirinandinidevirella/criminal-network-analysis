"""
RecordChain — criminal record integrity on the blockchain.

Every change to a criminal's record is appended to an immutable on-chain
history with the previous/new values and a data hash. The current database
record can be verified against the latest on-chain hash to detect tampering.
"""

from __future__ import annotations

import json
import logging
import time
from datetime import datetime, timezone
from typing import Any

from app.blockchain.web3_connector import get_web3_connector
from app.services.crypto_service import get_crypto_service

logger = logging.getLogger("crimenet.record_chain")


def _fmt_ts(ts: int) -> str:
    if not ts:
        return ""
    return datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


class RecordChain:
    """Criminal-record change history + integrity verification."""

    def __init__(self) -> None:
        self.connector = get_web3_connector()
        self.crypto = get_crypto_service()

    async def create_criminal_on_chain(self, criminal_id: str, criminal_data: dict[str, Any]) -> dict[str, Any]:
        """Initialise a criminal record on-chain."""
        data_hash = self.crypto.hash_data_dict(criminal_data)
        try:
            tx = self.connector.backend.record_create(criminal_id, data_hash)
        except ValueError as exc:
            logger.debug("Record %s already on chain: %s", criminal_id, exc)
            tx = {"transaction_hash": None, "block_number": None}
        return {"success": True, "criminal_id": criminal_id, "data_hash": data_hash,
                "transaction_hash": tx.get("transaction_hash"), "block_number": tx.get("block_number")}

    async def update_criminal_on_chain(
        self,
        criminal_id: str,
        update_type: str,
        previous_data: dict[str, Any],
        new_data: dict[str, Any],
        reason: str,
        officer_badge: str,
    ) -> dict[str, Any]:
        """Append an update to the immutable on-chain history."""
        prev_json = json.dumps(previous_data, sort_keys=True, default=str)
        new_json = json.dumps(new_data, sort_keys=True, default=str)
        new_hash = self.crypto.hash_data_dict(new_data)

        # Ensure the record exists (create if first write).
        latest = self.connector.backend.record_latest_hash(criminal_id)
        if latest is None:
            await self.create_criminal_on_chain(criminal_id, new_data)

        tx = self.connector.backend.record_update(
            criminal_id, update_type, prev_json, new_json, reason, new_hash, officer_badge,
        )
        return {"success": True, "criminal_id": criminal_id, "update_type": update_type,
                "new_hash": new_hash, "transaction_hash": tx.get("transaction_hash"),
                "block_number": tx.get("block_number")}

    async def verify_criminal_data_integrity(self, criminal_id: str, current_data: dict[str, Any]) -> dict[str, Any]:
        """Check whether the database record matches the on-chain hash."""
        current_hash = self.crypto.hash_data_dict(current_data)
        latest = self.connector.backend.record_latest_hash(criminal_id)
        intact = bool(latest) and self.connector.backend.record_verify(criminal_id, current_hash)
        return {
            "intact": intact,
            "blockchain_hash": latest,
            "current_hash": current_hash,
            "last_verified": _fmt_ts(int(time.time())),
            "warning": None if intact else "DATA MAY HAVE BEEN MODIFIED!",
        }

    async def get_complete_change_history(self, criminal_id: str) -> list[dict[str, Any]]:
        """The full append-only change history for a criminal."""
        records = self.connector.backend.record_history(criminal_id)
        out = []
        for r in records:
            out.append({
                "updateId": r.get("updateId"),
                "updateType": r.get("updateType"),
                "previousValue": r.get("previousValue"),
                "newValue": r.get("newValue"),
                "officerBadgeId": r.get("officerBadgeId"),
                "timestamp": r.get("timestamp"),
                "formattedTimestamp": _fmt_ts(r.get("timestamp") or 0),
                "reason": r.get("reason"),
                "dataHash": r.get("dataHash"),
            })
        return out

    async def mark_high_risk(self, criminal_id: str) -> dict[str, Any]:
        """Flag a record as high-risk on-chain."""
        tx = self.connector.backend.record_mark_high_risk(criminal_id)
        return {"success": True, "criminal_id": criminal_id,
                "transaction_hash": tx.get("transaction_hash")}
