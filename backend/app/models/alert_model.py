"""
Alert schemas.
"""

from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


class ResolveRequest(BaseModel):
    """Body for resolving an alert."""

    resolution_note: str = Field(..., min_length=2)


class AssignRequest(BaseModel):
    """Body for assigning an alert to an officer."""

    officer_id: str = Field(..., min_length=2)


class AlertRuleRequest(BaseModel):
    """Body for creating a custom alert rule."""

    rule_type: str = Field(..., min_length=2)
    conditions: dict[str, Any] = Field(default_factory=dict)
    notify_to: Optional[str] = None


class AlertOut(BaseModel):
    """An alert as returned by the API."""

    id: int
    title: str
    description: str = ""
    severity: str = "MEDIUM"
    category: str = "GENERAL"
    criminal_id: Optional[str] = None
    criminal_name: Optional[str] = None
    status: str = "ACTIVE"
    assigned_to: Optional[str] = None
    created_at: Optional[str] = None
