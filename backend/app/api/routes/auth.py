"""
Authentication routes.

POST /api/auth/login    — badge/password login, returns JWT pair + profile
POST /api/auth/refresh  — exchange a refresh token for a new access token
POST /api/auth/logout   — audit the logout
GET  /api/auth/me       — current user profile + permissions
"""

from __future__ import annotations

import hashlib
import logging
import secrets
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field

from app.api.middleware.auth_middleware import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user,
)
from app.api.middleware.rate_limiter import rate_limiter
from app.api.routes import fail, ok
from app.config import settings
from app.database.postgres_connection import fetch_one
from app.database.redis_connection import get_redis

logger = logging.getLogger("crimenet.auth")
router = APIRouter()

# ── Password hashing (bcrypt preferred, PBKDF2 fallback) ─────────────────────
try:
    import bcrypt

    def hash_password(password: str) -> str:
        """Hash a plaintext password for storage."""
        pw_bytes = password.encode("utf-8")[:72]
        salt = bcrypt.gensalt(rounds=settings.bcrypt_rounds)
        return bcrypt.hashpw(pw_bytes, salt).decode("utf-8")

    def verify_password(password: str, hashed: str) -> bool:
        """Verify a plaintext password against a stored hash."""
        try:
            pw_bytes = password.encode("utf-8")[:72]
            return bcrypt.checkpw(pw_bytes, hashed.encode("utf-8"))
        except Exception:
            return False

except Exception:  # noqa: BLE001 - bcrypt unavailable, fallback to PBKDF2
    def hash_password(password: str) -> str:
        """Hash a plaintext password with PBKDF2."""
        salt = secrets.token_hex(16)
        digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 120_000)
        return f"pbkdf2${salt}${digest.hex()}"

    def verify_password(password: str, hashed: str) -> bool:
        """Verify a plaintext password against PBKDF2 hash."""
        try:
            _, salt, digest = hashed.split("$", 2)
            candidate = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 120_000)
            return secrets.compare_digest(candidate.hex(), digest)
        except Exception:  # noqa: BLE001
            return False


# ── Request schemas ───────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    badge_id: str = Field(..., min_length=2)
    password: str = Field(..., min_length=1)
    department: Optional[str] = None


class RefreshRequest(BaseModel):
    refresh_token: str = Field(..., min_length=10)


# ── Helpers ───────────────────────────────────────────────────────────────────
def _login_failures(ip: str) -> int:
    """Return the number of recent failed logins from an IP."""
    try:
        key = f"login:fail:{ip}"
        r = get_redis()
        return int(r.get(key) or 0)
    except Exception:  # noqa: BLE001
        return 0


def _record_login_failure(ip: str) -> None:
    """Increment the failed-login counter for an IP."""
    try:
        key = f"login:fail:{ip}"
        r = get_redis()
        r.incr(key)
        r.expire(key, 900)  # 15-minute window
    except Exception:  # noqa: BLE001
        pass


def _clear_login_failures(ip: str) -> None:
    try:
        get_redis().delete(f"login:fail:{ip}")
    except Exception:  # noqa: BLE001
        pass


DEMO_USERS: dict[str, dict[str, Any]] = {
    "admin@crimenet.gov.in": {
        "id": "00000000-0000-0000-0000-000000000001",
        "badge_id": "admin@crimenet.gov.in",
        "name": "System Administrator",
        "role": "ADMIN",
        "department": "Ministry of Home Affairs",
        "email": "admin@crimenet.gov.in",
        "password": "Admin@123",
        "active": True,
    },
    "officer@crimenet.gov.in": {
        "id": "00000000-0000-0000-0000-000000000002",
        "badge_id": "officer@crimenet.gov.in",
        "name": "Inspector S. Sharma",
        "role": "OFFICER",
        "department": "Mumbai Police",
        "email": "officer@crimenet.gov.in",
        "password": "Officer@123",
        "active": True,
    },
    "analyst@crimenet.gov.in": {
        "id": "00000000-0000-0000-0000-000000000003",
        "badge_id": "analyst@crimenet.gov.in",
        "name": "Analyst A. Nair",
        "role": "ANALYST",
        "department": "CBI",
        "email": "analyst@crimenet.gov.in",
        "password": "Analyst@123",
        "active": True,
    },
    "senior@crimenet.gov.in": {
        "id": "00000000-0000-0000-0000-000000000004",
        "badge_id": "senior@crimenet.gov.in",
        "name": "SP R. Deshmukh",
        "role": "SENIOR_OFFICER",
        "department": "Maharashtra Police",
        "email": "senior@crimenet.gov.in",
        "password": "Senior@123",
        "active": True,
    },
}


# ── Routes ────────────────────────────────────────────────────────────────────
@router.post("/login", dependencies=[Depends(rate_limiter)])
async def login(request: Request, body: LoginRequest) -> dict[str, Any]:
    """Authenticate an officer and return access/refresh tokens."""
    ip = request.client.host if request.client else "unknown"
    if _login_failures(ip) >= settings.max_failed_login_attempts:
        raise HTTPException(
            status.HTTP_423_LOCKED,
            detail="Too many failed attempts. Try again later.",
        )

    user: Optional[dict[str, Any]] = None
    try:
        user = fetch_one(
            "SELECT * FROM users WHERE (badge_id = %s OR email = %s) AND active = TRUE",
            (body.badge_id, body.badge_id),
        )
    except Exception as exc:
        logger.warning("Postgres fetch_one failed: %s; falling back to demo users", exc)

    if not user:
        demo = DEMO_USERS.get(body.badge_id.strip().lower())
        if demo and body.password == demo["password"]:
            user = {
                "id": demo["id"],
                "badge_id": demo["badge_id"],
                "name": demo["name"],
                "role": demo["role"],
                "department": demo["department"],
                "email": demo["email"],
                "password_hash": hash_password(demo["password"]),
                "active": True,
            }
        else:
            _record_login_failure(ip)
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    elif not verify_password(body.password, user["password_hash"]):
        _record_login_failure(ip)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    _clear_login_failures(ip)
    profile = _profile(user)
    access_token = create_access_token(user)
    refresh_token = create_refresh_token(user)

    from app.api.middleware.audit_logger import log_action

    log_action("LOGIN", user={"sub": str(user["id"])}, ip_address=ip)
    return ok(
        {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "user_profile": profile,
            "role": user["role"],
        },
        message="Login successful",
    )


@router.post("/refresh", dependencies=[Depends(rate_limiter)])
async def refresh(body: RefreshRequest) -> dict[str, Any]:
    """Exchange a valid refresh token for a fresh access token."""
    try:
        payload = decode_token(body.refresh_token)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token") from exc
    if payload.get("type") != "refresh":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Not a refresh token")

    sub = str(payload.get("sub"))
    user = None
    try:
        user = fetch_one("SELECT * FROM users WHERE id = %s", (sub,))
    except Exception:
        pass

    if not user:
        for demo in DEMO_USERS.values():
            if demo["id"] == sub or demo["badge_id"] == sub:
                user = demo
                break

    if not user:
        user = {"id": sub, "badge_id": sub, "name": "Officer", "role": "OFFICER"}

    return ok({"access_token": create_access_token(user)}, message="Token refreshed")


@router.post("/logout")
async def logout(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    """Audit the logout action."""
    from app.api.middleware.audit_logger import log_action

    log_action("LOGOUT", user=user)
    return ok(None, message="Logged out")


@router.get("/me")
async def me(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    """Return the current user profile and permissions."""
    db_user = None
    try:
        db_user = fetch_one("SELECT * FROM users WHERE id = %s", (user.get("sub"),))
    except Exception:
        pass
    profile = _profile(db_user) if db_user else user
    permissions = _permissions(profile.get("role", "VIEWER"))
    return ok({"user_profile": profile, "permissions": permissions})


# ── Profile helpers ───────────────────────────────────────────────────────────
def _profile(user: dict[str, Any]) -> dict[str, Any]:
    """Strip sensitive fields from a user row."""
    return {
        "id": user.get("id"),
        "badge_id": user.get("badge_id"),
        "name": user.get("name"),
        "role": user.get("role"),
        "department": user.get("department"),
        "email": user.get("email"),
    }


def _permissions(role: str) -> dict[str, bool]:
    """Return the coarse permission matrix for a role."""
    matrix = {
        "ADMIN": {
            "view_all": True, "edit_all": True, "delete_records": True,
            "generate_reports": True, "manage_users": True, "view_audit_logs": True,
        },
        "SENIOR_OFFICER": {
            "view_all": True, "edit_all": True, "delete_records": False,
            "generate_reports": True, "manage_users": False, "view_audit_logs": True,
        },
        "OFFICER": {
            "view_all": True, "edit_all": False, "delete_records": False,
            "generate_reports": True, "manage_users": False, "view_audit_logs": False,
        },
        "ANALYST": {
            "view_all": True, "edit_all": False, "delete_records": False,
            "generate_reports": False, "manage_users": False, "view_audit_logs": False,
        },
        "VIEWER": {
            "view_all": False, "edit_all": False, "delete_records": False,
            "generate_reports": False, "manage_users": False, "view_audit_logs": False,
        },
    }
    return matrix.get(role, matrix["VIEWER"])
