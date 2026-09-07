"""
Alert service — lifecycle management for alerts plus real-time push.

Alerts are persisted in PostgreSQL and broadcast to connected WebSocket
clients the moment they are created.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Optional

from app.database.postgres_connection import execute, execute_returning_id, fetch_all, fetch_one
from app.database.redis_connection import cache_set, TTL
from app.websocket.alert_websocket import manager

logger = logging.getLogger("crimenet.alerts")


def create_alert(
    title: str,
    description: str = "",
    severity: str = "MEDIUM",
    category: str = "GENERAL",
    criminal_id: Optional[str] = None,
    criminal_name: Optional[str] = None,
    source: str = "SYSTEM",
) -> dict[str, Any]:
    """
    Persist a new alert and push it to all WebSocket clients.

    Returns the created alert dict.
    """
    alert_id = execute_returning_id(
        """
        INSERT INTO alerts (title, description, severity, category, criminal_id, criminal_name, source)
        VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id
        """,
        (title, description, severity, category, criminal_id, criminal_name, source),
    )
    row = fetch_one(
        "SELECT * FROM alerts WHERE id = %s", (alert_id,)
    ) if alert_id else None
    alert = row or {
        "id": None, "title": title, "description": description, "severity": severity,
        "category": category, "criminal_id": criminal_id, "criminal_name": criminal_name,
        "status": "ACTIVE", "source": source,
    }
    # Invalidate the active-alerts cache.
    cache_set("alerts:active:list", [], TTL["alerts"])
    # Push asynchronously without blocking the request.
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.create_task(manager.notify_alert(alert))
    except Exception as exc:  # noqa: BLE001
        logger.debug("WebSocket notify skipped: %s", exc)
    return alert


def list_active() -> list[dict[str, Any]]:
    """Return active alerts, most severe / newest first."""
    return fetch_all(
        """
        SELECT * FROM alerts
        WHERE status = 'ACTIVE'
        ORDER BY
          CASE severity WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1
                        WHEN 'MEDIUM' THEN 2 ELSE 3 END,
          created_at DESC
        LIMIT 200
        """
    )


def get_alert(alert_id: int) -> Optional[dict[str, Any]]:
    """Fetch a single alert by id."""
    return fetch_one("SELECT * FROM alerts WHERE id = %s", (alert_id,))


def resolve_alert(alert_id: int, resolution_note: str) -> dict[str, Any]:
    """Mark an alert as resolved."""
    execute(
        "UPDATE alerts SET status = 'RESOLVED', resolution = %s WHERE id = %s",
        (resolution_note, alert_id),
    )
    cache_set("alerts:active:list", [], TTL["alerts"])
    return get_alert(alert_id) or {}


def escalate_alert(alert_id: int) -> dict[str, Any]:
    """Escalate an alert to a senior officer."""
    execute("UPDATE alerts SET severity = 'CRITICAL', status = 'ESCALATED' WHERE id = %s", (alert_id,))
    cache_set("alerts:active:list", [], TTL["alerts"])
    return get_alert(alert_id) or {}


def assign_alert(alert_id: int, officer_id: str) -> dict[str, Any]:
    """Assign an alert to an officer."""
    execute("UPDATE alerts SET assigned_to = %s WHERE id = %s", (officer_id, alert_id))
    return get_alert(alert_id) or {}


def history(
    severity: Optional[str] = None, category: Optional[str] = None, limit: int = 200
) -> list[dict[str, Any]]:
    """Return alert history with optional filters."""
    query = "SELECT * FROM alerts WHERE 1=1"
    params: list[Any] = []
    if severity:
        query += " AND severity = %s"
        params.append(severity)
    if category:
        query += " AND category = %s"
        params.append(category)
    query += " ORDER BY created_at DESC LIMIT %s"
    params.append(limit)
    return fetch_all(query, tuple(params))


def create_rule(
    rule_name: str, conditions: dict[str, Any], notify_to: str, created_by: Optional[str]
) -> dict[str, Any]:
    """Create a custom alert rule (persisted for evaluation by the engine)."""
    import json

    rule_id = execute_returning_id(
        """
        INSERT INTO alert_rules (rule_name, conditions_json, notify_to, created_by)
        VALUES (%s, %s, %s, %s) RETURNING id
        """,
        (rule_name, json.dumps(conditions), notify_to, created_by),
    )
    return {"id": rule_id, "rule_name": rule_name, "active": True}


def list_rules() -> list[dict[str, Any]]:
    """List configured alert rules."""
    return fetch_all("SELECT * FROM alert_rules ORDER BY created_at DESC")


def statistics() -> dict[str, Any]:
    """Return alert statistics for the alerts dashboard."""
    rows = fetch_all(
        """
        SELECT
          count(*) AS total,
          sum(CASE WHEN severity = 'CRITICAL' THEN 1 ELSE 0 END) AS critical,
          sum(CASE WHEN severity = 'HIGH' THEN 1 ELSE 0 END) AS high,
          sum(CASE WHEN severity = 'MEDIUM' THEN 1 ELSE 0 END) AS medium,
          sum(CASE WHEN severity = 'LOW' THEN 1 ELSE 0 END) AS low
        FROM alerts
        """
    )
    return rows[0] if rows else {}
