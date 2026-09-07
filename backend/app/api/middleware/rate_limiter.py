"""
Rate limiter middleware / dependency.

Fixed-window counter backed by Redis. Keys are per-user when a valid JWT is
present, otherwise per-IP. Default: 100 requests per minute (configurable via
RATE_LIMIT_PER_MINUTE).
"""

from __future__ import annotations

import logging

from fastapi import HTTPException, Request, status

from app.api.middleware.auth_middleware import decode_token
from app.config import settings
from app.database.redis_connection import get_redis

logger = logging.getLogger("crimenet.ratelimit")


def _identity(request: Request) -> str:
    """Return a stable identity string for rate-limit bucketing."""
    header = request.headers.get("authorization", "")
    if header.lower().startswith("bearer "):
        try:
            payload = decode_token(header.split(" ", 1)[1].strip())
            if payload.get("sub"):
                return f"user:{payload['sub']}"
        except Exception:  # noqa: BLE001 - fall back to IP on any decode error
            pass
    ip = request.client.host if request.client else "unknown"
    return f"ip:{ip}"


async def rate_limiter(request: Request) -> None:
    """FastAPI dependency enforcing the per-minute request budget."""
    r = get_redis()
    key = f"ratelimit:{_identity(request)}"
    try:
        current = r.incr(key)
        if current == 1:
            r.expire(key, 60)
        if current > settings.rate_limit_per_minute:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded. Please slow down.",
            )
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001 - fail open if Redis is down
        logger.debug("Rate limiter unavailable: %s", exc)
