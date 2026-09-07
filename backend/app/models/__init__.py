"""
Application models.

These are lightweight Pydantic-style request/response schemas and entity
representations used across services. They intentionally avoid importing
heavy ML/database modules so they can be used anywhere.
"""

from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


# ── Enums ─────────────────────────────────────────────────────────────────────
class RiskLevel(str, Enum):
    """Criminal risk bands (colour-coded in the UI)."""

    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class CrimeStatus(str, Enum):
    """Status of a crime event."""

    OPEN = "OPEN"
    UNDER_INVESTIGATION = "UNDER_INVESTIGATION"
    CHARGESHEETED = "CHARGESHEETED"
    CONVICTED = "CONVICTED"
    ACQUITTED = "ACQUITTED"
    CLOSED = "CLOSED"


class CriminalStatus(str, Enum):
    """Current status of a person in the system."""

    WANTED = "WANTED"
    ARRESTED = "ARRESTED"
    UNDER_INVESTIGATION = "UNDER_INVESTIGATION"
    CONVICTED = "CONVICTED"
    RELEASED = "RELEASED"
    UNKNOWN = "UNKNOWN"


# ── Entity schemas ────────────────────────────────────────────────────────────
class Person(BaseModel):
    """A person (criminal) node."""

    id: Optional[str] = None
    name: str
    aliases: list[str] = Field(default_factory=list)
    age: Optional[int] = None
    gender: Optional[str] = None
    nationality: Optional[str] = "IN"
    address: Optional[str] = None
    criminal_id: Optional[str] = None
    risk_score: float = 0.0
    crime_types: list[str] = Field(default_factory=list)
    status: str = "UNKNOWN"
    photo_url: Optional[str] = None
    verified: bool = False
    important_flag: bool = False
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class Vehicle(BaseModel):
    """A vehicle node."""

    id: Optional[str] = None
    registration_number: str
    type: str = "CAR"
    make: Optional[str] = None
    model: Optional[str] = None
    color: Optional[str] = None
    year: Optional[int] = None
    owner_name: Optional[str] = None
    seized: bool = False
    used_in_crimes: list[str] = Field(default_factory=list)


class Account(BaseModel):
    """A financial account node."""

    id: Optional[str] = None
    account_number: str
    bank_name: Optional[str] = None
    ifsc_code: Optional[str] = None
    account_type: str = "SAVINGS"
    flagged: bool = False
    frozen: bool = False
    total_suspicious_amount: float = 0.0
    currency: str = "INR"


class Organization(BaseModel):
    """A criminal organization / gang node."""

    id: Optional[str] = None
    name: str
    type: str = "GANG"
    founded_year: Optional[int] = None
    location: Optional[str] = None
    members_count: int = 0
    crime_specialty: list[str] = Field(default_factory=list)
    threat_level: str = "MEDIUM"
    active: bool = True


class Location(BaseModel):
    """A geographic location node."""

    id: Optional[str] = None
    name: str
    city: Optional[str] = None
    state: Optional[str] = None
    country: str = "IN"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    crime_count: int = 0
    hotspot_score: float = 0.0


class Transaction(BaseModel):
    """A financial transaction node."""

    id: Optional[str] = None
    amount: float
    currency: str = "INR"
    date: Optional[datetime] = None
    type: str = "TRANSFER"
    suspicious: bool = False
    flagged_reason: Optional[str] = None


class CrimeEvent(BaseModel):
    """A crime event node."""

    id: Optional[str] = None
    crime_type: str
    date: Optional[datetime] = None
    severity: str = "MEDIUM"
    description: Optional[str] = None
    status: str = "OPEN"
    case_number: Optional[str] = None


# ── Alert schema ──────────────────────────────────────────────────────────────
class Alert(BaseModel):
    """An alert raised by the anomaly/risk engines."""

    id: Optional[str] = None
    title: str
    description: str = ""
    severity: str = "MEDIUM"  # CRITICAL | HIGH | MEDIUM | LOW
    category: str = "GENERAL"  # FINANCIAL | COMMUNICATION | LOCATION | NETWORK ...
    criminal_id: Optional[str] = None
    criminal_name: Optional[str] = None
    source: str = "SYSTEM"
    status: str = "ACTIVE"
    created_at: Optional[datetime] = None


# ── Generic API helpers ───────────────────────────────────────────────────────
class Paginated(BaseModel):
    """Generic paginated result wrapper."""

    items: list[Any]
    total: int
    page: int
    limit: int
    pages: int
