"""
Financial account schemas.
"""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class AccountBase(BaseModel):
    """Common account fields."""

    account_number: str = Field(..., min_length=4)
    bank_name: Optional[str] = None
    ifsc_code: Optional[str] = None
    account_type: str = "SAVINGS"
    flagged: bool = False
    frozen: bool = False
    total_suspicious_amount: float = 0.0
    currency: str = "INR"


class AccountCreate(AccountBase):
    """Request schema for creating an account."""

    owner_id: Optional[str] = None


class AccountOut(AccountBase):
    """Response schema for an account."""

    id: str
