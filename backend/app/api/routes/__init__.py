"""
Shared helpers for API route modules.

Every endpoint returns a consistent JSON envelope:
    {
        "success": true|false,
        "data": ...,
        "message": "...",
        "error": null | "...",
        "timestamp": "ISO-8601"
    }
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional


def ok(data: Any = None, message: str = "Success") -> dict[str, Any]:
    """Build a standard success envelope."""
    return {
        "success": True,
        "data": data,
        "message": message,
        "error": None,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def fail(message: str, error: Optional[str] = None, data: Any = None) -> dict[str, Any]:
    """Build a standard error envelope."""
    return {
        "success": False,
        "data": data,
        "message": message,
        "error": error or message,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
