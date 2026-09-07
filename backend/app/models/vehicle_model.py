"""
Vehicle schemas.
"""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class VehicleBase(BaseModel):
    """Common vehicle fields."""

    registration_number: str = Field(..., min_length=4)
    type: str = "CAR"
    make: Optional[str] = None
    model: Optional[str] = None
    color: Optional[str] = None
    year: Optional[int] = None
    owner_name: Optional[str] = None
    seized: bool = False
    used_in_crimes: list[str] = Field(default_factory=list)


class VehicleCreate(VehicleBase):
    """Request schema for creating a vehicle."""

    owner_id: Optional[str] = None


class VehicleOut(VehicleBase):
    """Response schema for a vehicle."""

    id: str
