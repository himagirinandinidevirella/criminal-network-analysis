"""
Network analysis schemas.
"""

from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


class NetworkFilter(BaseModel):
    """Filters applied to full-graph queries."""

    crime_type: Optional[str] = None
    risk_level: Optional[str] = None
    organization: Optional[str] = None
    location: Optional[str] = None
    limit: int = Field(2000, ge=10, le=20000)


class PathRequest(BaseModel):
    """Body for the shortest-path endpoint."""

    from_id: str = Field(..., min_length=1)
    to_id: str = Field(..., min_length=1)


class WhatIfRequest(BaseModel):
    """Body for the what-if simulator."""

    criminal_id: str = Field(..., min_length=1)
    action: str = "ARREST"  # ARREST | ELIMINATE | FLIP


class PredictLinksRequest(BaseModel):
    """Body for the link-prediction endpoint."""

    top_k: int = Field(10, ge=1, le=100)
    threshold: float = Field(0.75, ge=0.0, le=1.0)


class CommunityOut(BaseModel):
    """A detected community with member summary."""

    id: int
    name: str
    members: list[str]
    size: int
    crime_types: list[str] = Field(default_factory=list)
    members_detail: list[dict[str, Any]] = Field(default_factory=list)
