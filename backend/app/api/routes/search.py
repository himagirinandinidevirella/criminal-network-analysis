"""
Search routes.

POST /api/search/intelligent — ranked full-text/entity search
GET  /api/search/suggest     — autocomplete suggestions
POST /api/search/save        — save a search for later
"""

from __future__ import annotations

import json
import logging
from typing import Any, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from app.api.middleware.auth_middleware import get_current_user
from app.api.routes import ok
from app.database import neo4j_connection as neo
from app.database.postgres_connection import execute, fetch_all

logger = logging.getLogger("crimenet.search")
router = APIRouter(dependencies=[Depends(get_current_user)])


class SearchRequest(BaseModel):
    """Body for the intelligent search endpoint."""

    query: str = Field(..., min_length=1)
    filters: dict[str, Any] = Field(default_factory=dict)
    page: int = Field(1, ge=1)
    limit: int = Field(20, ge=1, le=100)


@router.post("/intelligent")
async def intelligent_search(body: SearchRequest) -> dict[str, Any]:
    """Search across all entity types with relevance ranking."""
    term = body.query.strip()
    results: list[dict[str, Any]] = []

    # Person search: name / alias match ranked by risk.
    persons = neo.run_query(
        """
        MATCH (p:Person)
        WHERE toLower(p.name) CONTAINS toLower($term)
           OR ANY(a IN coalesce(p.aliases, []) WHERE toLower(a) CONTAINS toLower($term))
        RETURN properties(p) AS props, 'Person' AS kind
        LIMIT 100
        """,
        {"term": term},
    )
    for r in persons:
        props = r["props"]
        results.append({
            "id": props.get("id"), "kind": "Person", "name": props.get("name"),
            "risk_score": props.get("risk_score", 0), "aliases": props.get("aliases", []),
            "crime_types": props.get("crime_types", []), "status": props.get("status"),
        })

    orgs = neo.run_query(
        "MATCH (o:Organization) WHERE toLower(o.name) CONTAINS toLower($term) "
        "RETURN properties(o) AS props, 'Organization' AS kind LIMIT 50",
        {"term": term},
    )
    for r in orgs:
        results.append({"id": r["props"].get("id"), "kind": "Organization",
                        "name": r["props"].get("name"),
                        "threat_level": r["props"].get("threat_level")})

    vehicles = neo.run_query(
        "MATCH (v:Vehicle) WHERE toLower(v.registration_number) CONTAINS toLower($term) "
        "RETURN properties(v) AS props, 'Vehicle' AS kind LIMIT 50",
        {"term": term},
    )
    for r in vehicles:
        results.append({"id": r["props"].get("id"), "kind": "Vehicle",
                        "name": r["props"].get("registration_number"),
                        "seized": r["props"].get("seized")})

    accounts = neo.run_query(
        "MATCH (a:Account) WHERE toLower(a.account_number) CONTAINS toLower($term) "
        "RETURN properties(a) AS props, 'Account' AS kind LIMIT 50",
        {"term": term},
    )
    for r in accounts:
        results.append({"id": r["props"].get("id"), "kind": "Account",
                        "name": r["props"].get("account_number"),
                        "flagged": r["props"].get("flagged")})

    locations = neo.run_query(
        "MATCH (l:Location) WHERE toLower(l.name) CONTAINS toLower($term) "
        "OR toLower(l.city) CONTAINS toLower($term) RETURN properties(l) AS props, 'Location' AS kind LIMIT 50",
        {"term": term},
    )
    for r in locations:
        results.append({"id": r["props"].get("id"), "kind": "Location",
                        "name": r["props"].get("name"),
                        "hotspot_score": r["props"].get("hotspot_score")})

    # Rank: exact name match > alias match > partial; risk boosts ranking.
    results.sort(key=lambda r: (
        0 if str(r.get("name", "")).lower() == term.lower() else 1,
        -(r.get("risk_score") or 0),
    ))

    total = len(results)
    start = (body.page - 1) * body.limit
    page_items = results[start:start + body.limit]
    return ok({
        "items": page_items,
        "total": total,
        "page": body.page,
        "limit": body.limit,
        "pages": max(1, -(-total // body.limit)),
    })


@router.get("/suggest")
async def suggest(partial_query: str = Query("", min_length=1)) -> dict[str, Any]:
    """Return autocomplete suggestions for a partial query."""
    term = partial_query.strip()
    if not term:
        return ok([])
    suggestions: list[str] = []
    for label, prop in [("Person", "name"), ("Organization", "name"),
                        ("Location", "name"), ("Vehicle", "registration_number")]:
        rows = neo.run_query(
            f"MATCH (n:{label}) WHERE toLower(n.{prop}) STARTS WITH toLower($term) "
            f"RETURN n.{prop} AS name LIMIT 8",
            {"term": term},
        )
        suggestions.extend(r["name"] for r in rows if r.get("name"))
    # Dedupe preserving order.
    seen: set[str] = set()
    unique = []
    for s in suggestions:
        if s.lower() not in seen:
            seen.add(s.lower())
            unique.append(s)
    return ok(unique[:12])


@router.post("/save")
async def save_search(body: SearchRequest, user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    """Save a search query for later retrieval."""
    name = body.filters.get("name") or body.query[:40]
    execute(
        "INSERT INTO saved_searches (user_id, query, filters_json, name) VALUES (%s, %s, %s, %s)",
        (user.get("sub"), body.query, json.dumps(body.filters), name),
    )
    return ok(None, message="Search saved")


@router.get("/saved")
async def saved_searches(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    """List the current user's saved searches."""
    rows = fetch_all(
        "SELECT * FROM saved_searches WHERE user_id = %s ORDER BY created_at DESC",
        (user.get("sub"),),
    )
    return ok(rows)
