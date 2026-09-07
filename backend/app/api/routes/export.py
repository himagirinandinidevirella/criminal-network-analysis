"""
Export routes — raw data exports for inter-agency sharing.

GET /api/export/criminals/csv  — criminals CSV (filterable)
GET /api/export/network/csv     — edges CSV
GET /api/export/report/{id}/excel — report Excel (multi-sheet)
"""

from __future__ import annotations

import logging
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse

from app.api.middleware.auth_middleware import get_current_user
from app.services import export_service

logger = logging.getLogger("crimenet.export")
router = APIRouter(dependencies=[Depends(get_current_user)])


@router.get("/criminals/csv")
async def criminals_csv(
    risk_level: Optional[str] = None,
    crime_type: Optional[str] = None,
    status_filter: Optional[str] = None,
) -> FileResponse:
    """Download all criminals as CSV (optionally filtered)."""
    filters = {"risk_level": risk_level, "crime_type": crime_type, "status": status_filter}
    path = export_service.export_criminals_csv(filters)
    return FileResponse(path, media_type="text/csv", filename=path.name)


@router.get("/network/csv")
async def network_csv() -> FileResponse:
    """Download the network edges as CSV."""
    path = export_service.export_network_csv()
    return FileResponse(path, media_type="text/csv", filename=path.name)


@router.get("/report/{report_id}/excel")
async def report_excel(report_id: str) -> FileResponse:
    """Download a report as a multi-sheet Excel file."""
    # Rebuild a lightweight report document for the given entity.
    from app.services.report_service import _build_report_document  # noqa: PLC2701

    doc = _build_report_document(
        report_type="export", entity_id=report_id, title=f"Export {report_id}",
        classification="CONFIDENTIAL", sections={}, include_sections=[],
    )
    path = export_service.export_report_excel(doc, stem=f"report_{report_id}")
    return FileResponse(
        path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=path.name,
    )
