"""
Report service — generates case, criminal, network and executive reports.

Supported output formats: PDF (ReportLab), CSV, Excel (openpyxl) and JSON.
Generated files are stored under the configured report storage directory and
recorded in PostgreSQL `report_history`.
"""

from __future__ import annotations

import asyncio
import csv
import io
import json
import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from app.config import settings
from app.database import neo4j_connection as neo
from app.database.postgres_connection import execute
from app.services import risk_service

logger = logging.getLogger("crimenet.reports")

SECTIONS = [
    "personal", "network", "risk", "timeline", "vehicles", "accounts",
    "associates", "anomalies", "predictions", "recommendations",
]


def _person_full(criminal_id: str) -> dict[str, Any]:
    """Assemble the complete data bundle for a criminal report."""
    person = risk_service.get_person(criminal_id) or {}
    risk = risk_service.score_criminal(criminal_id)

    vehicles = neo.run_query(
        "MATCH (p:Person {id: $pid})-[:OWNS_VEHICLE]->(v:Vehicle) RETURN properties(v) AS props",
        {"pid": criminal_id},
    )
    accounts = neo.run_query(
        "MATCH (p:Person {id: $pid})-[:OWNS_ACCOUNT]->(a:Account) RETURN properties(a) AS props",
        {"pid": criminal_id},
    )
    associates = neo.run_query(
        """
        MATCH (p:Person {id: $pid})-[r]-(m:Person)
        RETURN m.name AS name, m.risk_score AS risk_score, type(r) AS relation
        """,
        {"pid": criminal_id},
    )
    crimes = neo.run_query(
        """
        MATCH (p:Person {id: $pid})-[:PARTICIPATED_IN]->(c:CrimeEvent)
        RETURN properties(c) AS props
        ORDER BY c.date DESC
        """,
        {"pid": criminal_id},
    )

    return {
        "profile": person,
        "risk": risk,
        "vehicles": [v["props"] for v in vehicles],
        "accounts": [a["props"] for a in accounts],
        "associates": associates,
        "crimes": [c["props"] for c in crimes],
    }


def _predictions(criminal_id: str) -> dict[str, Any]:
    """Run the crime predictor for the report."""
    from app.ml_models.crime_predictor import get_crime_predictor

    person = risk_service.get_person(criminal_id) or {}
    return get_crime_predictor().predict(person, risk_service._network_features(criminal_id))


def _anomalies(criminal_id: str) -> dict[str, Any]:
    """Run anomaly detection for the report."""
    from app.services.anomaly_service import analyze_criminal

    return analyze_criminal(criminal_id)


def generate_criminal_report(
    criminal_id: str,
    sections: Optional[list[str]] = None,
    fmt: str = "PDF",
    classification: str = "CONFIDENTIAL",
    officer: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    """Generate a criminal profile report and return its metadata + file path."""
    sections = sections or SECTIONS
    bundle = _person_full(criminal_id)
    if sections != SECTIONS:
        pass  # full bundle already computed; sections filtered at render time

    report = _build_report_document(
        report_type="criminal",
        entity_id=criminal_id,
        title=f"Criminal Profile — {bundle['profile'].get('name', criminal_id)}",
        classification=classification,
        sections={
            "personal": {"profile": bundle["profile"]},
            "network": {"associates": bundle["associates"]},
            "risk": {"risk": bundle["risk"]},
            "timeline": {"crimes": bundle["crimes"]},
            "vehicles": {"vehicles": bundle["vehicles"]},
            "accounts": {"accounts": bundle["accounts"]},
            "associates": {"associates": bundle["associates"]},
            "anomalies": _anomalies(criminal_id),
            "predictions": _predictions(criminal_id),
            "recommendations": _recommendations(bundle["risk"]),
        },
        include_sections=sections,
    )

    return _render(report, fmt, officer, entity_id=criminal_id)


def generate_network_report(
    fmt: str = "PDF",
    classification: str = "CONFIDENTIAL",
    officer: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    """Generate a network analysis report."""
    from app.services.graph_service import get_communities, get_key_players, get_statistics

    report = _build_report_document(
        report_type="network",
        entity_id="full-network",
        title="Criminal Network Analysis",
        classification=classification,
        sections={
            "personal": {},
            "network": {
                "statistics": get_statistics(),
                "key_players": get_key_players(),
                "communities": get_communities(),
            },
            "risk": {},
            "timeline": {},
            "vehicles": {},
            "accounts": {},
            "associates": {},
            "anomalies": {},
            "predictions": {},
            "recommendations": {},
        },
        include_sections=["network"],
    )
    return _render(report, fmt, officer, entity_id="network")


def generate_case_report(
    case_id: str,
    fmt: str = "PDF",
    classification: str = "CONFIDENTIAL",
    officer: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    """Generate a case investigation report."""
    report = _build_report_document(
        report_type="case",
        entity_id=case_id,
        title=f"Case Investigation — {case_id}",
        classification=classification,
        sections={s: {} for s in SECTIONS},
        include_sections=["personal", "timeline", "associates", "recommendations"],
    )
    return _render(report, fmt, officer, entity_id=case_id)


def generate_executive_report(
    fmt: str = "PDF",
    classification: str = "CONFIDENTIAL",
    officer: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    """Generate an executive summary report."""
    from app.services.graph_service import get_statistics

    report = _build_report_document(
        report_type="executive",
        entity_id="executive",
        title="Executive Summary — Criminal Intelligence",
        classification=classification,
        sections={
            s: {"statistics": get_statistics()} if s == "network" else {}
            for s in SECTIONS
        },
        include_sections=["network", "risk", "recommendations"],
    )
    return _render(report, fmt, officer, entity_id="executive")


def _recommendations(risk: dict[str, Any]) -> dict[str, Any]:
    """Generate structured recommendations from the risk score."""
    score = risk.get("score", 0)
    level = risk.get("level", "LOW")
    recs = [
        f"Subject assessed at {level} risk ({score}/100).",
    ]
    if score >= 81:
        recs += [
            "Initiate immediate surveillance and obtain arrest warrant.",
            "Freeze all linked financial accounts pending investigation.",
            "Notify border control and airports (watchlist).",
        ]
    elif score >= 61:
        recs += [
            "Increase patrol presence in subject's known areas.",
            "Monitor communication channels for 30 days.",
        ]
    else:
        recs += ["Continue periodic monitoring; re-evaluate in 60 days."]
    return {"recommendations": recs}


def _build_report_document(
    report_type: str,
    entity_id: str,
    title: str,
    classification: str,
    sections: dict[str, Any],
    include_sections: list[str],
) -> dict[str, Any]:
    """Assemble the internal report document structure."""
    filtered = {s: sections.get(s, {}) for s in include_sections}
    return {
        "report_id": str(uuid.uuid4()),
        "report_type": report_type,
        "entity_id": entity_id,
        "title": title,
        "classification": classification,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "generator": settings.app_name,
        "sections": filtered,
    }


def _render(
    report: dict[str, Any],
    fmt: str,
    officer: Optional[dict[str, Any]],
    entity_id: str,
) -> dict[str, Any]:
    """Render the report document into the requested format and persist it."""
    fmt = fmt.upper()
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    stem = f"{report['report_type']}_{entity_id}_{ts}"

    if fmt == "PDF":
        path = _render_pdf(report, stem)
    elif fmt == "CSV":
        path = _render_csv(report, stem)
    elif fmt == "EXCEL":
        path = _render_excel(report, stem)
    else:  # JSON
        path = _render_json(report, stem)

    officer_id = (officer or {}).get("sub")
    execute(
        """
        INSERT INTO report_history (report_type, entity_id, format, generated_by, file_url)
        VALUES (%s, %s, %s, %s, %s)
        """,
        (report["report_type"], report["entity_id"], fmt, officer_id, str(path)),
    )

    # Register a blockchain certificate for the report (best-effort).
    try:
        from app.blockchain.report_chain import ReportChain

        async def _register() -> None:
            await ReportChain().register_report(
                report_id=report["report_id"],
                report_type=report["report_type"],
                entity_id=report["entity_id"],
                report_bytes=path.read_bytes(),
                classification=report["classification"],
                officer_badge=str(officer_id or "system"),
            )

        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None
        if loop is not None:
            loop.create_task(_register())
        else:
            asyncio.run(_register())
    except Exception as exc:  # noqa: BLE001
        logger.debug("Blockchain report certificate skipped: %s", exc)

    return {
        "report_id": report["report_id"],
        "file_path": str(path),
        "file_name": path.name,
        "format": fmt,
        "classification": report["classification"],
    }


# ── Renderers ────────────────────────────────────────────────────────────────
def _render_json(report: dict[str, Any], stem: str) -> Path:
    path = settings.report_storage_dir / f"{stem}.json"
    path.write_text(json.dumps(report, indent=2, default=str), encoding="utf-8")
    return path


def _render_csv(report: dict[str, Any], stem: str) -> Path:
    """CSV export of the tabular parts of the report."""
    path = settings.report_storage_dir / f"{stem}.csv"
    with path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow(["Report", report["title"]])
        writer.writerow(["Generated", report["generated_at"]])
        writer.writerow([])
        for name, section in report["sections"].items():
            writer.writerow([name.upper()])
            data = section or {}
            for key, value in data.items():
                if isinstance(value, (list, dict)):
                    value = json.dumps(value, default=str)
                writer.writerow([key, value])
            writer.writerow([])
    return path


def _render_excel(report: dict[str, Any], stem: str) -> Path:
    """Excel export with one sheet per section."""
    from openpyxl import Workbook

    path = settings.report_storage_dir / f"{stem}.xlsx"
    wb = Workbook()
    wb.remove(wb.active)
    for name, section in report["sections"].items():
        ws = wb.create_sheet(title=name[:31] or "Sheet")
        data = section or {}
        for row_idx, (key, value) in enumerate(data.items(), start=1):
            ws.cell(row=row_idx, column=1, value=str(key))
            ws.cell(row=row_idx, column=2, value=json.dumps(value, default=str) if isinstance(value, (dict, list)) else str(value))
    wb.save(path)
    return path


def _render_pdf(report: dict[str, Any], stem: str) -> Path:
    """Build a formatted PDF report with ReportLab + classification watermark."""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.pdfgen import canvas as pdf_canvas
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table

    path = settings.report_storage_dir / f"{stem}.pdf"
    styles = getSampleStyleSheet()
    doc = SimpleDocTemplate(
        str(path), pagesize=A4,
        topMargin=20 * mm, bottomMargin=20 * mm,
        leftMargin=18 * mm, rightMargin=18 * mm,
        title=report["title"], author=report["generator"],
    )

    story = [
        Paragraph(report["title"], styles["Title"]),
        Paragraph(
            f"<b>Classification:</b> {report['classification']} &nbsp;|&nbsp; "
            f"<b>Generated:</b> {report['generated_at'][:19]} &nbsp;|&nbsp; "
            f"<b>System:</b> {report['generator']}",
            styles["Normal"],
        ),
        Spacer(1, 6 * mm),
    ]

    for name, section in report["sections"].items():
        story.append(Paragraph(name.upper(), styles["Heading2"]))
        rows = [[Paragraph("<b>Field</b>", styles["Normal"]),
                 Paragraph("<b>Value</b>", styles["Normal"])]]
        data = section or {}
        if not data:
            rows.append([Paragraph("—", styles["Normal"]), Paragraph("No data", styles["Normal"])])
        for key, value in data.items():
            text = json.dumps(value, default=str) if isinstance(value, (dict, list)) else str(value)
            rows.append([Paragraph(str(key), styles["Normal"]), Paragraph(text[:400], styles["Normal"])])
        table = Table(rows, colWidths=[60 * mm, 110 * mm])
        table.setStyle([
            ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#111827")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
        ])
        story.append(table)
        story.append(Spacer(1, 4 * mm))

    # Watermark: draw classification diagonally on every page.
    def _draw_watermark(canvas: pdf_canvas.Canvas, doc_obj) -> None:  # noqa: ANN001
        canvas.saveState()
        canvas.setFont("Helvetica-Bold", 44)
        canvas.setFillColor(colors.Color(0.9, 0.1, 0.1, alpha=0.12))
        canvas.translate(90 * mm, 150 * mm)
        canvas.rotate(45)
        canvas.drawCentredString(0, 0, report["classification"])
        canvas.restoreState()

    doc.build(story, onFirstPage=_draw_watermark, onLaterPages=_draw_watermark)
    return path
