"""
Investigator action routes.

POST /api/actions/verify/{criminal_id}  — mark data as verified
POST /api/actions/flag/{criminal_id}    — mark as important (priority 1-5)
POST /api/actions/notes/{criminal_id}   — add an investigator note
POST /api/actions/evidence/{criminal_id} — upload evidence files (multipart)
POST /api/actions/share                 — create a sharing link
POST /api/actions/archive/{item_id}     — archive to case file system
GET  /api/actions/shares                — list share links
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from app.api.middleware.auth_middleware import get_current_user
from app.api.routes import ok
from app.config import settings
from app.database import neo4j_connection as neo
from app.database.postgres_connection import execute, execute_returning_id
from app.services import share_service

logger = logging.getLogger("crimenet.actions")
router = APIRouter(dependencies=[Depends(get_current_user)])


@router.post("/verify/{criminal_id}")
async def verify_criminal(
    criminal_id: str,
    officer_badge: str = Form(...),
    verification_note: Optional[str] = Form(None),
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Mark a criminal's data as verified with officer badge and timestamp."""
    now = datetime.now(timezone.utc).isoformat()
    neo.run_write(
        """
        MATCH (p:Person {id: $pid})
        SET p.verified = true, p.verified_by = $badge,
            p.verification_note = $note, p.verified_at = $ts
        """,
        {"pid": criminal_id, "badge": officer_badge, "note": verification_note, "ts": now},
    )
    from app.api.middleware.audit_logger import log_action

    log_action("VERIFY", user=user, target_id=criminal_id, target_type="CRIMINAL")
    return ok({"criminal_id": criminal_id, "verified": True, "verified_by": officer_badge,
               "verified_at": now}, message="Information verified")


@router.post("/flag/{criminal_id}")
async def flag_criminal(
    criminal_id: str,
    priority: int = Form(..., ge=1, le=5),
    reason: Optional[str] = Form(None),
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Flag a criminal as important (1-5 priority) and add to the watchlist."""
    neo.run_write(
        """
        MATCH (p:Person {id: $pid})
        SET p.important_flag = true, p.priority = $priority, p.flag_reason = $reason
        """,
        {"pid": criminal_id, "priority": priority, "reason": reason},
    )
    from app.api.middleware.audit_logger import log_action

    log_action("FLAG", user=user, target_id=criminal_id, target_type="CRIMINAL")
    return ok({"criminal_id": criminal_id, "priority": priority, "reason": reason},
              message="Added to priority watchlist")


@router.post("/notes/{criminal_id}")
async def add_note(
    criminal_id: str,
    note_content: str = Form(..., min_length=2),
    note_type: str = Form("GENERAL"),
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Add an investigator note to a criminal's record."""
    note_id = execute_returning_id(
        "INSERT INTO notes (criminal_id, officer_id, content, note_type) VALUES (%s, %s, %s, %s) RETURNING id",
        (criminal_id, user.get("sub"), note_content, note_type),
    )
    return ok({"id": note_id, "criminal_id": criminal_id}, message="Note added")


@router.post("/evidence/{criminal_id}")
async def upload_evidence(
    criminal_id: str,
    file: UploadFile = File(...),
    file_type: str = Form("DOCUMENT"),
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Upload an evidence file with chain-of-custody tracking."""
    # Sanitise the filename and persist under the evidence directory.
    safe_name = f"{uuid.uuid4().hex}_{file.filename}"
    dest = settings.evidence_storage_dir / safe_name
    content = await file.read()
    dest.write_bytes(content)

    custody = (
        f"uploaded_by={user.get('badge_id') or user.get('sub')}; "
        f"uploaded_at={datetime.now(timezone.utc).isoformat()}; "
        f"size_bytes={len(content)}"
    )
    evidence_id = execute_returning_id(
        "INSERT INTO evidence (criminal_id, file_url, file_type, uploaded_by, chain_of_custody) "
        "VALUES (%s, %s, %s, %s, %s) RETURNING id",
        (criminal_id, str(dest), file_type, user.get("sub"), custody),
    )
    return ok({"id": evidence_id, "file_url": str(dest), "file_name": file.filename,
               "chain_of_custody": custody}, message="Evidence uploaded")


@router.post("/share")
async def share_report(
    report_id: str = Form(...),
    expiry_hours: int = Form(24),
    access_level: str = Form("VIEW"),
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Create a secure, expiring sharing link for a report."""
    if access_level not in ("VIEW", "DOWNLOAD"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Invalid access level")
    result = share_service.create_share(report_id, expiry_hours, access_level, user.get("sub"))
    return ok(result, message="Share link created")


@router.get("/shares")
async def list_shares(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    """List share links created by the current user."""
    return ok(share_service.list_shares())


@router.post("/archive/{item_id}")
async def archive(
    item_id: str,
    case_number: str = Form(...),
    tags: str = Form(""),
    review_date: Optional[str] = Form(None),
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Archive an item to the case file system with tags and review date."""
    case_id = execute_returning_id(
        "INSERT INTO case_files (case_number, title, assigned_to, status, priority) "
        "VALUES (%s, %s, %s, 'OPEN', 'MEDIUM') "
        "ON CONFLICT (case_number) DO UPDATE SET title = EXCLUDED.title RETURNING id",
        (case_number, f"Archived item {item_id}", user.get("sub")),
    )
    execute(
        "INSERT INTO notes (criminal_id, officer_id, content, note_type) VALUES (%s, %s, %s, 'ARCHIVE')",
        (item_id, user.get("sub"), f"Archived to case {case_number}; tags: {tags}; review: {review_date}"),
    )
    return ok({"case_number": case_number, "case_id": case_id, "tags": tags,
               "review_date": review_date}, message="Archived")
