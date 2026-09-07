"""
JWT authentication middleware and helpers.

Implements:
  * access/refresh token creation and decoding (python-jose)
  * `get_current_user` FastAPI dependency (raises 401 on invalid tokens)
  * `require_role` dependency factory for coarse RBAC
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.config import settings

# Bearer token extractor (returns 401 automatically if header is missing).
_bearer = HTTPBearer(auto_error=False)

# Role hierarchy: a role may perform anything a lower role can.
ROLE_LEVEL = {
    "ADMIN": 100,
    "SENIOR_OFFICER": 80,
    "OFFICER": 60,
    "ANALYST": 40,
    "VIEWER": 10,
}


def create_access_token(user: dict[str, Any]) -> str:
    """Create a short-lived access token for a user."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user.get("id", user.get("badge_id"))),
        "badge_id": user.get("badge_id"),
        "name": user.get("name"),
        "role": user.get("role", "VIEWER"),
        "department": user.get("department"),
        "type": "access",
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_expire_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_refresh_token(user: dict[str, Any]) -> str:
    """Create a long-lived refresh token for a user."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user.get("id", user.get("badge_id"))),
        "type": "refresh",
        "iat": now,
        "exp": now + timedelta(days=settings.refresh_token_expire_days),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict[str, Any]:
    """Decode and validate a JWT, raising JWTError on failure."""
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])


def _extract_token(
    credentials: Optional[HTTPAuthorizationCredentials],
    authorization: Optional[str] = None,
) -> Optional[str]:
    """Pull the bearer token from either the credentials object or a raw header."""
    if credentials is not None:
        return credentials.credentials
    if authorization and authorization.lower().startswith("bearer "):
        return authorization.split(" ", 1)[1].strip()
    return None


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> dict[str, Any]:
    """FastAPI dependency: resolve and validate the current user from the JWT."""
    token = _extract_token(credentials)
    if token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = decode_token(token)
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not an access token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return payload


def require_role(*roles: str):
    """Return a dependency that enforces one of the given roles."""

    def _checker(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
        user_role = user.get("role", "VIEWER")
        if user_role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{user_role}' is not permitted for this action",
            )
        return user

    return _checker
