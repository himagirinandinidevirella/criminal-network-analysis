"""
Network analysis routes.

GET  /api/network/full         — full/filtered graph for Cytoscape
GET  /api/network/communities  — detected communities
POST /api/network/path         — shortest path between two entities
POST /api/network/whatif       — arrest/remove simulation
GET  /api/network/keyplayers   — top entities by PageRank/centrality
POST /api/network/predict-links — probable hidden connections
GET  /api/network/statistics   — aggregate network stats
"""

from __future__ import annotations

import logging
from typing import Any, Optional

from fastapi import APIRouter, Depends, Query

from app.api.middleware.auth_middleware import get_current_user
from app.api.routes import ok
from app.database.redis_connection import cache_get, cache_set, TTL
from app.models.network_model import PathRequest, PredictLinksRequest, WhatIfRequest
from app.services import graph_service

logger = logging.getLogger("crimenet.network")
router = APIRouter(dependencies=[Depends(get_current_user)])


@router.get("/full")
async def full_graph(
    crime_type: Optional[str] = None,
    risk_level: Optional[str] = None,
    organization: Optional[str] = None,
    location: Optional[str] = None,
    limit: int = Query(2000, ge=10, le=20000),
) -> dict[str, Any]:
    """Return the knowledge graph (nodes + edges) for the network map."""
    cache_key = f"network:graph:{crime_type or ''}:{risk_level or ''}:{organization or ''}:{location or ''}"
    cached = cache_get(cache_key)
    if cached:
        return ok(cached)
    data = graph_service.get_full_graph(
        crime_type=crime_type, risk_level=risk_level,
        organization=organization, location=location, limit=limit,
    )
    cache_set(cache_key, data, TTL["graph"])
    return ok(data)


@router.get("/communities")
async def communities() -> dict[str, Any]:
    """Return detected communities (gangs/networks) with member details."""
    return ok(graph_service.get_communities())


@router.post("/path")
async def path(body: PathRequest) -> dict[str, Any]:
    """Find the shortest connection path between two entities."""
    return ok(graph_service.find_path(body.from_id, body.to_id))


@router.post("/whatif")
async def whatif(body: WhatIfRequest) -> dict[str, Any]:
    """Simulate removing a criminal and compare network structure."""
    return ok(graph_service.what_if(body.criminal_id, body.action))


@router.get("/keyplayers")
async def keyplayers() -> dict[str, Any]:
    """Return the top 10 influential entities by PageRank and centrality."""
    cache_key = "network:keyplayers"
    cached = cache_get(cache_key)
    if cached:
        return ok(cached)
    data = graph_service.get_key_players()
    cache_set(cache_key, data, TTL["pagerank"])
    return ok(data)


@router.post("/predict-links")
async def predict_links(body: PredictLinksRequest) -> dict[str, Any]:
    """Predict probable hidden connections in the network."""
    return ok(graph_service.predict_links(body.top_k, body.threshold))


@router.get("/statistics")
async def statistics() -> dict[str, Any]:
    """Return aggregate network statistics and trends."""
    return ok(graph_service.get_statistics())
