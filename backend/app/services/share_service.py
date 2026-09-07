"""
Share service — secure, expiring report sharing links.

Generates cryptographically random share tokens, enforces expiry and access
levels, and tracks every access (who / when / how many times).
"""

from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from app.config import settings
from app.database.postgres_connection import execute, fetch_one

ACCESS_LEVELS = {"VIEW", "DOWNLOAD"}


def create_share(
    report_id: str,
    expiry_hours: int = 24,
    access_level: str = "VIEW",
    created_by: Optional[str] = None,
) -> dict[str, Any]:
    """
    Create a share token for a report.

    Returns {share_token, share_url, expiry}.
    """
    token = secrets.token_urlsafe(24)
    expiry = datetime.now(timezone.utc) + timedelta(hours=expiry_hours)
    execute(
        """
        INSERT INTO shared_reports (report_id, token, expiry, access_level, created_by)
        VALUES (%s, %s, %s, %s, %s)
        """,
        (report_id, token, expiry, access_level, created_by),
    )
    return {
        "share_token": token,
        "share_url": f"{settings.share_base_url}/{token}",
        "expiry": expiry.isoformat(),
        "access_level": access_level,
    }


def validate_token(token: str) -> Optional[dict[str, Any]]:
    """
    Validate a share token, returning the share record if it is valid and
    unexpired, otherwise None.
    """
    row = fetch_one(
        "SELECT * FROM shared_reports WHERE token = %s", (token,)
    )
    if not row:
        return None
    expiry = row.get("expiry")
    if expiry is not None:
        # psycopg2 returns aware datetime objects for TIMESTAMPTZ.
        now = datetime.now(timezone.utc)
        if expiry < now:
            return None
    return row


def record_access(token: str) -> None:
    """Increment the access counter for a share token."""
    execute(
        "UPDATE shared_reports SET access_count = access_count + 1 WHERE token = %s",
        (token,),
    )


def revoke(token: str) -> bool:
    """Revoke a share token."""
    count = execute(
        "DELETE FROM shared_reports WHERE token = %s", (token,)
    )
    return count > 0


def list_shares() -> list[dict[str, Any]]:
    """List all share records."""
    from app.database.postgres_connection import fetch_all

    return fetch_all("SELECT * FROM shared_reports ORDER BY created_at DESC LIMIT 200")
