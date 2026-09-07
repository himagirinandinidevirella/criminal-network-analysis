"""
Public (no-auth) routes for shared reports.

GET  /api/public/report/{token}            — read-only, watermarked report
POST /api/public/report/{token}/download   — download the report file
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import FileResponse

from app.api.routes import fail, ok
from app.services import share_service

logger = logging.getLogger("crimenet.public")
router = APIRouter()


@router.get("/report/{token}")
async def public_report(token: str) -> dict[str, Any]:
    """
    Serve a read-only shared report. Validates the token and expiry, records
    the access, and returns the watermarked report payload.
    """
    share = share_service.validate_token(token)
    if not share:
        return fail("Invalid or expired share link", error="NOT_FOUND")
    share_service.record_access(token)
    return ok({
        "report_id": share.get("report_id"),
        "access_level": share.get("access_level"),
        "watermarked": True,
        "notice": "This is a read-only, watermarked copy of a shared report.",
    })


@router.post("/report/{token}/download")
async def public_download(token: str) -> Any:
    """Download a shared report file (requires DOWNLOAD access level)."""
    share = share_service.validate_token(token)
    if not share:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Invalid or expired share link")
    if share.get("access_level") != "DOWNLOAD":
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="This link is view-only")
    share_service.record_access(token)
    # Locate the report file from report_history.
    from app.database.postgres_connection import fetch_one

    row = fetch_one(
        "SELECT file_url FROM report_history WHERE report_id = %s LIMIT 1",
        (share.get("report_id"),),
    )
    if not row or not row.get("file_url"):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Report file not found")
    return FileResponse(row["file_url"], filename=row["file_url"].split("/")[-1])
