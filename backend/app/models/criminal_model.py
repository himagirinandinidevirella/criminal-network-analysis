"""
Criminal domain schemas (Pydantic v2).

Request/response models for the criminal routes.
"""

from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


class FIRAnalysisRequest(BaseModel):
    """Body for the FIR auto-analysis endpoint."""

    fir_text: str = Field(..., min_length=10, description="Raw FIR text to analyse")
    language: str = Field("en", description="Language code (en/hi/ta/bn/mr/te)")


class CriminalQueryParams(BaseModel):
    """Query parameters accepted by the criminal list endpoint."""

    page: int = Field(1, ge=1)
    limit: int = Field(20, ge=1, le=200)
    risk_level: Optional[str] = None
    crime_type: Optional[str] = None
    location: Optional[str] = None
    status: Optional[str] = None
    sort_by: str = "risk_score"


class VerifyRequest(BaseModel):
    """Body for the verify-information action."""

    officer_badge: str = Field(..., min_length=2)
    verification_note: Optional[str] = None


class FlagRequest(BaseModel):
    """Body for the mark-as-important action."""

    priority: int = Field(..., ge=1, le=5)
    reason: Optional[str] = None


class NoteRequest(BaseModel):
    """Body for adding an investigator note."""

    note_content: str = Field(..., min_length=2)
    note_type: str = "GENERAL"


class TimelineQuery(BaseModel):
    """Query parameters for a criminal timeline."""

    start_date: Optional[str] = None
    end_date: Optional[str] = None


class CriminalListItem(BaseModel):
    """One row of the paginated criminal list."""

    id: str
    name: str
    criminal_id: Optional[str] = None
    risk_score: float = 0.0
    crime_types: list[str] = Field(default_factory=list)
    status: str = "UNKNOWN"
    location: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    aliases: list[str] = Field(default_factory=list)
    important_flag: bool = False
    verified: bool = False
    meta: dict[str, Any] = Field(default_factory=dict)
