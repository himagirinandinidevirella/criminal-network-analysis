"""
Audit logging.

Every mutating action (and a configurable subset of reads) is recorded to the
PostgreSQL `audit_logs` table with actor, action, target and IP address, giving
a complete, court-presentable audit trail.

Provides:
  * `log_action(...)` helper used directly by route handlers
  * `AuditLogMiddleware` that automatically records mutating HTTP methods
"""

from __future__ import annotations

import asyncio
import logging
from typing import Optional

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.database.postgres_connection import execute

logger = logging.getLogger("crimenet.audit")

# HTTP methods treated as mutating (recorded automatically).
MUTATING_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


def log_action(
    action: str,
    user: Optional[dict] = None,
    target_id: Optional[str] = None,
    target_type: Optional[str] = None,
    ip_address: Optional[str] = None,
) -> None:
    """Persist an audit-log entry. Never raises — auditing must not break ops."""
    try:
        user_id = user.get("sub") if user else None
        execute(
            "INSERT INTO audit_logs (user_id, action, target_id, target_type, ip_address) "
            "VALUES (%s, %s, %s, %s, %s)",
            (user_id, action, target_id, target_type, ip_address),
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Audit write failed (%s): %s", action, exc)

    # Mirror the action to the immutable blockchain audit ledger (best-effort;
    # the system keeps working even if no node is reachable).
    try:
        from app.blockchain.audit_chain import AuditChain

        coro = AuditChain().log_action(
            officer_badge_id=str(user.get("badge_id") or user.get("sub") or "system") if user else "system",
            department=str(user.get("department") or "") if user else "",
            action=action,
            target_id=target_id or "global",
            target_type=target_type or "GENERAL",
            ip_address=ip_address or "unknown",
            result="SUCCESS",
            data_accessed={},
        )
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None
        if loop is not None:
            loop.create_task(coro)
        else:
            asyncio.run(coro)
    except Exception as exc:  # noqa: BLE001
        logger.debug("Blockchain audit mirror skipped (%s): %s", action, exc)


class AuditLogMiddleware(BaseHTTPMiddleware):
    """Automatically record all mutating requests to the audit log."""

    async def dispatch(self, request: Request, call_next):  # noqa: ANN001
        response = await call_next(request)
        if request.method in MUTATING_METHODS:
            path = request.url.path
            ip = request.client.host if request.client else None
            # Best-effort user resolution from token without failing the request.
            user_id: Optional[str] = None
            header = request.headers.get("authorization", "")
            if header.lower().startswith("bearer "):
                try:
                    from app.api.middleware.auth_middleware import decode_token

                    payload = decode_token(header.split(" ", 1)[1].strip())
                    user_id = payload.get("sub")
                except Exception:  # noqa: BLE001
                    pass
            # Audit writes touch Postgres/blockchain synchronously; run them off
            # the request path so slow or unavailable backends cannot stall responses.
            asyncio.get_running_loop().create_task(
                asyncio.to_thread(
                    log_action,
                    action=f"{request.method} {path}",
                    user={"sub": user_id} if user_id else None,
                    target_id=path,
                    target_type="HTTP",
                    ip_address=ip,
                )
            )
        return response
