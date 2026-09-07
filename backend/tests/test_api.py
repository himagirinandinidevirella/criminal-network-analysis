"""
API route tests (FastAPI TestClient).

These tests exercise the public health endpoint and the auth flows. They are
written to run in CI with or without the full database stack by relying on the
health endpoint (which reports degradation gracefully) and standard error
responses.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_endpoint() -> None:
    """GET /health must return a well-formed envelope."""
    resp = client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert "success" in body
    assert "data" in body
    assert "databases" in body["data"]


def test_login_missing_body() -> None:
    """Login without credentials returns 422 (validation)."""
    resp = client.post("/api/auth/login", json={})
    assert resp.status_code == 422


@pytest.mark.integration
def test_login_invalid_credentials() -> None:
    """Login with bad credentials returns 401 (requires PostgreSQL)."""
    resp = client.post(
        "/api/auth/login",
        json={"badge_id": "nobody@crimenet.gov.in", "password": "wrong"},
    )
    assert resp.status_code in (401, 423)


def test_protected_route_requires_auth() -> None:
    """Criminal list requires an auth token."""
    resp = client.get("/api/criminals/")
    assert resp.status_code == 401


@pytest.mark.integration
def test_public_report_invalid_token() -> None:
    """An invalid share token returns success=False envelope (requires PostgreSQL)."""
    resp = client.get("/api/public/report/not-a-real-token")
    assert resp.status_code == 200
    assert resp.json()["success"] is False
