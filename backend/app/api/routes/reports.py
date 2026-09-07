"""
Report routes.

POST /api/reports/criminal/{id}  — criminal profile report (file download)
POST /api/reports/network        — network analysis report
POST /api/reports/case/{case_id} — case investigation report
POST /api/reports/executive      — executive summary report
GET  /api/reports/history        — list previously generated reports
"""

from __future__ import annotations

import logging
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from app.api.middleware.auth_middleware import get_current_user
from app.api.routes import ok
from app.database.postgres_connection import fetch_all
from app.services import report_service

logger = logging.getLogger("crimenet.reports")
router = APIRouter(dependencies=[Depends(get_current_user)])


class ReportRequest(BaseModel):
    """Configuration for report generation."""

    sections: Optional[list[str]] = None
    format: str = Field("PDF", pattern="^(PDF|CSV|EXCEL|JSON)$")
    classification: str = Field("CONFIDENTIAL", min_length=2)
    date_range: Optional[dict[str, Any]] = None


def _serve(result: dict[str, Any], fmt: str) -> Any:
    """Return a FileResponse for binary formats, JSON otherwise."""
    if fmt == "JSON":
        return ok(result)
    file_path = result.get("file_path")
    if not file_path:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Report generation failed")
    media = {
        "PDF": "application/pdf",
        "CSV": "text/csv",
        "EXCEL": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }.get(fmt, "application/octet-stream")
    return FileResponse(
        file_path,
        media_type=media,
        filename=result["file_name"],
        headers={"X-Report-Id": result.get("report_id", "")},
    )


@router.post("/criminal/{criminal_id}")
async def criminal_report(
    criminal_id: str,
    body: ReportRequest,
    user: dict[str, Any] = Depends(get_current_user),
) -> Any:
    """Generate and download a criminal profile report."""
    from app.api.middleware.audit_logger import log_action

    result = report_service.generate_criminal_report(
        criminal_id, body.sections, body.format.upper(), body.classification, user
    )
    log_action("GENERATE_REPORT", user=user, target_id=criminal_id, target_type="CRIMINAL")
    return _serve(result, body.format.upper())


@router.post("/network")
async def network_report(body: ReportRequest, user: dict[str, Any] = Depends(get_current_user)) -> Any:
    """Generate and download a network analysis report."""
    result = report_service.generate_network_report(body.format.upper(), body.classification, user)
    return _serve(result, body.format.upper())


@router.post("/case/{case_id}")
async def case_report(case_id: str, body: ReportRequest, user: dict[str, Any] = Depends(get_current_user)) -> Any:
    """Generate and download a case investigation report."""
    result = report_service.generate_case_report(case_id, body.format.upper(), body.classification, user)
    return _serve(result, body.format.upper())


@router.post("/executive")
async def executive_report(body: ReportRequest, user: dict[str, Any] = Depends(get_current_user)) -> Any:
    """Generate and download an executive summary report."""
    result = report_service.generate_executive_report(body.format.upper(), body.classification, user)
    return _serve(result, body.format.upper())


@router.get("/history")
async def history() -> dict[str, Any]:
    """List previously generated reports."""
    rows = fetch_all("SELECT * FROM report_history ORDER BY created_at DESC LIMIT 200")
    return ok(rows)
