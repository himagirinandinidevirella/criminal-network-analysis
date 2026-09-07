"""
CORS configuration helper.

Whitelists configured origins (defaults to the React dev server on
http://localhost:3000) and enables credentials for cookie/session flows.
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings


def configure_cors(app: FastAPI) -> None:
    """Attach the CORS middleware to the given FastAPI application."""
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["Content-Disposition"],
        max_age=600,
    )
