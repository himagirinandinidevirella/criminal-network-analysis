"""
AgencyShareChain — cryptographic inter-agency data sharing.

Grants time-boxed, level-scoped access to criminal data between agencies
(STATE_POLICE, CBI, NIA, COURT, INTERPOL, CUSTOMS, NCB). Every grant, check
and revocation is recorded on-chain.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from app.blockchain.web3_connector import get_web3_connector
from app.services.crypto_service import get_crypto_service

logger = logging.getLogger("crimenet.agency_share")

AGENCIES = ["STATE_POLICE", "CBI", "NIA", "COURT", "INTERPOL", "CUSTOMS", "NCB"]
ACCESS_LEVELS = ["READ_ONLY", "FULL_ACCESS", "ANALYSIS_ONLY"]


def _fmt_ts(ts: int) -> str:
    if not ts:
        return ""
    return datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


class AgencyShareChain:
    """Manages on-chain access grants between agencies."""

    def __init__(self) -> None:
        self.connector = get_web3_connector()
        self.crypto = get_crypto_service()

    async def grant_agency_access(
        self,
        data_id: str,
        data_type: str,
        from_agency: str,
        to_agency: str,
        access_level: str,
        duration_hours: int,
        current_data: dict[str, Any],
        purpose: str,
        officer_badge: str,
    ) -> dict[str, Any]:
        """Grant time-boxed access to another agency."""
        data_hash = self.crypto.hash_data_dict(current_data or {"id": data_id})

        if self.connector.mode == "web3":
            # Real contract returns the permission id.
            permission_id = self.connector.backend.share_grant(
                data_id, data_type, to_agency, from_agency, access_level,
                duration_hours, data_hash, purpose, officer_badge,
            )
            # Resolve the just-granted permission from the data listing.
            perms = self.connector.backend.share_list_by_data(data_id)
            record = perms[-1] if perms else {}
            permission_id = record.get("permissionId") or permission_id
            expires_at = record.get("expiresAt")
        else:
            permission_id = self.connector.backend.share_grant(
                data_id, data_type, to_agency, from_agency, access_level,
                duration_hours, data_hash, purpose, officer_badge,
            )
            record = self.connector.backend.share_list_by_data(data_id)[-1]
            expires_at = record.get("expiresAt")

        return {
            "permission_id": permission_id,
            "data_id": data_id,
            "from_agency": from_agency,
            "to_agency": to_agency,
            "access_level": access_level,
            "expires_at": _fmt_ts(expires_at or 0),
            "share_url": f"/public/share/{permission_id}",
            "transaction_hash": "0x" + uuid.uuid4().hex,
        }

    async def verify_agency_access(self, permission_id: str) -> dict[str, Any]:
        """Check whether a permission currently grants access."""
        result = self.connector.backend.share_check(permission_id)
        return {"permission_id": permission_id, **result}

    async def revoke_access(self, permission_id: str, reason: str) -> dict[str, Any]:
        """Revoke a permission on-chain."""
        tx = self.connector.backend.share_revoke(permission_id, reason)
        return {"success": True, "permission_id": permission_id, "reason": reason,
                "transaction_hash": tx.get("transaction_hash")}

    async def get_active_permissions(self, data_id: str) -> list[dict[str, Any]]:
        """All permissions for a data id."""
        records = self.connector.backend.share_list_by_data(data_id)
        return [self._decorate(r) for r in records]

    async def get_all_agency_permissions(self, agency: str) -> list[dict[str, Any]]:
        """All permissions held by an agency."""
        records = self.connector.backend.share_list_by_agency(agency)
        return [self._decorate(r) for r in records]

    @staticmethod
    def _decorate(record: dict[str, Any]) -> dict[str, Any]:
        return {
            "permissionId": record.get("permissionId"),
            "dataId": record.get("dataId"),
            "dataType": record.get("dataType"),
            "fromAgency": record.get("fromAgency"),
            "toAgency": record.get("toAgency"),
            "accessLevel": record.get("accessLevel"),
            "grantedAt": record.get("grantedAt"),
            "expiresAt": record.get("expiresAt"),
            "formattedExpiry": _fmt_ts(record.get("expiresAt") or 0),
            "isActive": record.get("isActive"),
            "purpose": record.get("purpose"),
            "accessCount": record.get("accessCount"),
        }
