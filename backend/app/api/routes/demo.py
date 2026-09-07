"""
Demo mode routes (SIH 2025 Section 13 — Hackathon Demo Scenario).

POST /api/demo/trigger-alert — simulate a live CRITICAL alert and push it to
                               every connected WebSocket client (flash + sound).
GET  /api/demo/status         — report demo readiness (is synthetic data seeded?)
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends

from app.api.middleware.auth_middleware import get_current_user
from app.api.routes import ok
from app.database import neo4j_connection as neo
from app.services import alert_service

logger = logging.getLogger("crimenet.demo")
router = APIRouter(dependencies=[Depends(get_current_user)])


@router.post("/trigger-alert")
async def trigger_alert(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    """
    Simulate a live alert for the demo scenario.

    The alert is persisted and broadcast over /ws/alerts, which triggers the
    frontend red flash, alert sound, toast and sidebar badge increment.
    """
    alert = alert_service.create_alert(
        title="HIGH-RISK NETWORK ACTIVITY",
        description=(
            "Raja Khan communicated with Eastern Network Boss — 47 calls detected "
            "in 24 hours, including 02:15 and 03:40 AM (47x above normal frequency)."
        ),
        severity="CRITICAL",
        category="COMMUNICATION",
        criminal_id=None,
        criminal_name="Raja Khan",
        source="DEMO",
    )
    return ok(alert, message="Demo alert triggered")


@router.get("/status")
async def demo_status() -> dict[str, Any]:
    """Report whether the synthetic dataset is loaded (demo readiness)."""
    try:
        rows = neo.run_query("MATCH (p:Person) RETURN count(p) AS c")
        persons = rows[0]["c"] if rows else 0
    except Exception:  # noqa: BLE001 - Neo4j may be down
        persons = 0
    return ok({
        "data_seeded": persons > 0,
        "persons": persons,
        "ready": persons > 0,
    })
