"""
Export service — CSV / Excel / JSON exports of raw data.

Used by the export routes and the report generator for inter-agency sharing
(NCRB / CBI / NIA / Interpol-style exports).
"""

from __future__ import annotations

import csv
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from app.config import settings
from app.database import neo4j_connection as neo

logger = logging.getLogger("crimenet.export")


def export_criminals_csv(filters: Optional[dict[str, Any]] = None) -> Path:
    """Export all persons (optionally filtered) to CSV."""
    filters = filters or {}
    where: list[str] = ["n:Person"]
    params: dict[str, Any] = {}
    if filters.get("risk_level") and filters["risk_level"] in ("CRITICAL", "HIGH", "MEDIUM", "LOW"):
        bands = {"CRITICAL": (81, 100), "HIGH": (61, 80), "MEDIUM": (31, 60), "LOW": (0, 30)}
        low, high = bands[filters["risk_level"]]
        where.append("n.risk_score >= $low AND n.risk_score <= $high")
        params["low"], params["high"] = low, high
    if filters.get("crime_type"):
        where.append("ANY(c IN coalesce(n.crime_types, []) WHERE c CONTAINS $crime)")
        params["crime"] = filters["crime_type"]
    if filters.get("status"):
        where.append("n.status = $status")
        params["status"] = filters["status"]

    query = (
        f"MATCH (n) WHERE {' AND '.join(where)} "
        "RETURN properties(n) AS props ORDER BY n.risk_score DESC LIMIT 5000"
    )
    rows = neo.run_query(query, params)

    path = settings.report_storage_dir / f"criminals_{datetime.now().strftime('%Y%m%d-%H%M%S')}.csv"
    with path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        header = ["criminal_id", "name", "aliases", "age", "gender", "status",
                  "risk_score", "crime_types", "address", "nationality"]
        writer.writerow(header)
        for row in rows:
            props = row["props"]
            writer.writerow([
                props.get("criminal_id", ""),
                props.get("name", ""),
                "; ".join(props.get("aliases", []) or []),
                props.get("age", ""),
                props.get("gender", ""),
                props.get("status", ""),
                props.get("risk_score", ""),
                "; ".join(props.get("crime_types", []) or []),
                props.get("address", ""),
                props.get("nationality", ""),
            ])
    return path


def export_network_csv() -> Path:
    """Export all graph edges to CSV (source, target, relationship, strength)."""
    rows = neo.run_query(
        """
        MATCH (a)-[r]->(b)
        RETURN a.id AS source, b.id AS target, type(r) AS relationship,
               coalesce(r.strength, r.amount, r.frequency, 1.0) AS strength
        LIMIT 20000
        """
    )
    path = settings.report_storage_dir / f"network_edges_{datetime.now().strftime('%Y%m%d-%H%M%S')}.csv"
    with path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow(["source", "target", "relationship", "strength"])
        for row in rows:
            writer.writerow([row["source"], row["target"], row["relationship"], row["strength"]])
    return path


def export_report_excel(report_data: dict[str, Any], stem: Optional[str] = None) -> Path:
    """Export a report document to a multi-sheet Excel file."""
    from openpyxl import Workbook

    stem = stem or f"report_{datetime.now().strftime('%Y%m%d-%H%M%S')}"
    path = settings.report_storage_dir / f"{stem}.xlsx"
    wb = Workbook()
    ws = wb.active
    ws.title = "Report"
    ws.cell(row=1, column=1, value=report_data.get("title", "Report"))
    for section_name, section in (report_data.get("sections") or {}).items():
        sheet = wb.create_sheet(section_name[:31])
        for i, (key, value) in enumerate((section or {}).items(), start=1):
            sheet.cell(row=i, column=1, value=str(key))
            sheet.cell(row=i, column=2, value=json.dumps(value, default=str) if isinstance(value, (dict, list)) else str(value))
    wb.save(path)
    return path
