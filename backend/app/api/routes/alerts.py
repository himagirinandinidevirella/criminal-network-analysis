"""
Alert routes.

GET  /api/alerts/active       — active alerts (prioritised)
POST /api/alerts/{id}/resolve — resolve an alert
POST /api/alerts/{id}/escalate — escalate to senior officer
POST /api/alerts/{id}/assign  — assign to an officer
GET  /api/alerts/history      — alert history (filtered)
POST /api/alerts/rules        — create a custom alert rule
GET  /api/alerts/rules        — list alert rules
GET  /api/alerts/statistics   — alert stats for the dashboard
"""

from __future__ import annotations

import logging
from typing import Any, Optional

from fastapi import APIRouter, Depends, Query

from app.api.middleware.auth_middleware import get_current_user
from app.api.middleware.rate_limiter import rate_limiter
from app.api.routes import ok
from app.models.alert_model import AlertRuleRequest, AssignRequest, ResolveRequest
from app.services import alert_service

logger = logging.getLogger("crimenet.alerts")
router = APIRouter(dependencies=[Depends(get_current_user)])


@router.get("/active")
async def active_alerts() -> dict[str, Any]:
    """Return active alerts, most severe first."""
    return ok(alert_service.list_active())


@router.post("/{alert_id}/resolve")
async def resolve(alert_id: int, body: ResolveRequest, user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    """Mark an alert as resolved with a note."""
    from app.api.middleware.audit_logger import log_action

    result = alert_service.resolve_alert(alert_id, body.resolution_note)
    log_action("RESOLVE_ALERT", user=user, target_id=str(alert_id), target_type="ALERT")
    return ok(result, message="Alert resolved")


@router.post("/{alert_id}/escalate")
async def escalate(alert_id: int, user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    """Escalate an alert to a senior officer."""
    from app.api.middleware.audit_logger import log_action

    result = alert_service.escalate_alert(alert_id)
    log_action("ESCALATE_ALERT", user=user, target_id=str(alert_id), target_type="ALERT")
    return ok(result, message="Alert escalated")


@router.post("/{alert_id}/assign")
async def assign(alert_id: int, body: AssignRequest, user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    """Assign an alert to an officer."""
    result = alert_service.assign_alert(alert_id, body.officer_id)
    return ok(result, message="Alert assigned")


@router.get("/history")
async def history(
    severity: Optional[str] = None,
    category: Optional[str] = None,
    limit: int = Query(200, ge=1, le=1000),
) -> dict[str, Any]:
    """Return alert history with optional filters."""
    return ok(alert_service.history(severity, category, limit))


@router.post("/rules", dependencies=[Depends(rate_limiter)])
async def create_rule(body: AlertRuleRequest, user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    """Create a custom alert rule."""
    result = alert_service.create_rule(
        body.rule_type, body.conditions, body.notify_to or "", user.get("sub")
    )
    return ok(result, message="Alert rule created")


@router.get("/rules")
async def list_rules() -> dict[str, Any]:
    """List configured alert rules."""
    return ok(alert_service.list_rules())


@router.get("/statistics")
async def statistics() -> dict[str, Any]:
    """Return alert statistics."""
    return ok(alert_service.statistics())
