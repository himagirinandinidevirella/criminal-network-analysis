"""
Criminal routes.

GET  /api/criminals/               — paginated/filtered criminal list
GET  /api/criminals/{id}           — complete profile
POST /api/criminals/analyze-fir    — NLP FIR analysis → graph update → risk
GET  /api/criminals/{id}/network   — ego network for Cytoscape
GET  /api/criminals/{id}/timeline  — chronological events
GET  /api/criminals/{id}/risk      — risk score + SHAP explanations + history
GET  /api/criminals/{id}/predictions — crime prediction report
GET  /api/criminals/{id}/anomalies — detected anomalies
"""

from __future__ import annotations

import logging
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.middleware.auth_middleware import get_current_user
from app.api.middleware.rate_limiter import rate_limiter
from app.api.routes import fail, ok
from app.database import neo4j_connection as neo
from app.database.redis_connection import cache_get, cache_set, TTL
from app.ml_models.risk_scorer import LEVELS
from app.models.criminal_model import FIRAnalysisRequest
from app.services import anomaly_service, graph_service, nlp_service, risk_service

logger = logging.getLogger("crimenet.criminal")
router = APIRouter(dependencies=[Depends(get_current_user)])


def _risk_band(level: str) -> tuple[int, int]:
    """Return (low, high) for a named risk band."""
    for low, high, name in LEVELS:
        if name == level:
            return low, high
    return 0, 100


@router.get("/")
async def list_criminals(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=200),
    risk_level: Optional[str] = None,
    crime_type: Optional[str] = None,
    location: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    sort_by: str = "risk_score",
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Return a paginated, filterable list of criminals."""
    where: list[str] = []
    params: dict[str, Any] = {}
    if risk_level:
        low, high = _risk_band(risk_level.upper())
        where.append("p.risk_score >= $low AND p.risk_score <= $high")
        params["low"], params["high"] = low, high
    if crime_type:
        where.append("ANY(c IN coalesce(p.crime_types, []) WHERE toLower(c) CONTAINS toLower($crime))")
        params["crime"] = crime_type
    if location:
        where.append("(p.address CONTAINS $loc OR EXISTS { MATCH (p)-[:LOCATED_AT]->(l:Location) WHERE l.name CONTAINS $loc })")
        params["loc"] = location
    if status_filter:
        where.append("p.status = $status")
        params["status"] = status_filter

    where_clause = ("WHERE " + " AND ".join(where)) if where else ""
    sort_map = {
        "risk_score": "p.risk_score DESC",
        "name": "p.name ASC",
        "recent": "p.updated_at DESC",
    }
    order = sort_map.get(sort_by, "p.risk_score DESC")

    total_row = neo.run_query(f"MATCH (p:Person) {where_clause} RETURN count(p) AS c", params)
    total = total_row[0]["c"] if total_row else 0

    skip = (page - 1) * limit
    rows = neo.run_query(
        f"""
        MATCH (p:Person)
        {where_clause}
        RETURN properties(p) AS props
        ORDER BY {order}
        SKIP $skip LIMIT $limit
        """,
        {**params, "skip": skip, "limit": limit},
    )
    items = [r["props"] for r in rows]
    pages = max(1, -(-total // limit))
    return ok({
        "items": items,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": pages,
    })


@router.post("/analyze-fir")
async def analyze_fir(
    body: FIRAnalysisRequest,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Analyse an FIR document and update the knowledge graph."""
    try:
        result = nlp_service.analyze_fir(body.fir_text, body.language)
        # Mirror extracted persons to the blockchain record ledger (best-effort).
        try:
            from app.blockchain.record_chain import RecordChain
            from app.services.nlp_service import _slug

            chain = RecordChain()
            for entity in result.get("entities", []):
                if entity.get("type") == "PERSON":
                    criminal_id = _slug(entity.get("text", ""))
                    await chain.create_criminal_on_chain(criminal_id, {
                        "id": criminal_id,
                        "name": entity.get("text"),
                        "source": "FIR",
                        "fir_excerpt": body.fir_text[:200],
                    })
        except Exception as exc:  # noqa: BLE001
            logger.warning("Blockchain record mirror skipped: %s", exc)
    except Exception as exc:  # noqa: BLE001
        logger.exception("FIR analysis failed")
        return fail("FIR analysis failed", error=str(exc))
    return ok(result, message="FIR analysed")


@router.post("/auto-investigate")
async def auto_investigate(
    body: dict[str, Any],
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """
    Autonomous multi-stage AI investigation:
    1. Multi-modal evidence extraction
    2. 1-to-N Biometric (AFIS Fingerprint/DNA) matching
    3. National ID & Digital asset tracing (Aadhaar, PAN, UPI, Crypto, IMEI)
    4. Multi-hop Neo4j cartel dot-connection
    5. Evidentiary lead rating (5-star legal admissibility scale)
    6. Autonomous tactical police directives
    """
    fir_text = body.get("fir_text", "")
    case_title = body.get("case_title")
    jurisdiction = body.get("jurisdiction", "Maharashtra Police / Crime Branch")
    language = body.get("language", "en")

    from app.services.investigation_engine import investigation_engine

    try:
        report = investigation_engine.investigate_case(
            fir_text=fir_text,
            case_title=case_title,
            jurisdiction=jurisdiction,
            language=language,
        )
        return ok(report, message="Autonomous investigation complete")
    except Exception as exc:
        logger.exception("Autonomous investigation failed")
        return fail("Autonomous investigation failed", error=str(exc))


@router.get("/{criminal_id}")
async def get_criminal(criminal_id: str) -> dict[str, Any]:
    """Return the complete profile of a criminal with all linked data."""
    cache_key = f"criminal:profile:{criminal_id}"
    cached = cache_get(cache_key)
    if cached:
        return ok(cached)

    person = risk_service.get_person(criminal_id)
    if not person:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Criminal not found")

    vehicles = neo.run_query(
        "MATCH (p:Person {id: $pid})-[:OWNS_VEHICLE]->(v:Vehicle) RETURN properties(v) AS props",
        {"pid": criminal_id},
    )
    accounts = neo.run_query(
        "MATCH (p:Person {id: $pid})-[:OWNS_ACCOUNT]->(a:Account) RETURN properties(a) AS props",
        {"pid": criminal_id},
    )
    associates = neo.run_query(
        """
        MATCH (p:Person {id: $pid})-[r]-(m:Person)
        RETURN m.id AS id, m.name AS name, m.risk_score AS risk_score,
               m.crime_types AS crime_types, type(r) AS relation
        LIMIT 50
        """,
        {"pid": criminal_id},
    )
    crimes = neo.run_query(
        "MATCH (p:Person {id: $pid})-[:PARTICIPATED_IN]->(c:CrimeEvent) RETURN properties(c) AS props ORDER BY c.date DESC",
        {"pid": criminal_id},
    )
    profile = {
        "person": person,
        "vehicles": [v["props"] for v in vehicles],
        "accounts": [a["props"] for a in accounts],
        "associates": associates,
        "crimes": [c["props"] for c in crimes],
        "risk": risk_service.score_criminal(criminal_id),
        "network_stats": risk_service._network_features(criminal_id),
    }
    cache_set(cache_key, profile, TTL["profile"])
    return ok(profile)


@router.get("/{criminal_id}/network")
async def criminal_network(criminal_id: str, depth: int = Query(1, ge=1, le=2)) -> dict[str, Any]:
    """Return the ego network around a criminal for Cytoscape."""
    cache_key = f"network:ego:{criminal_id}:{depth}"
    cached = cache_get(cache_key)
    if cached:
        return ok(cached)
    data = graph_service.get_person_network(criminal_id, depth)
    cache_set(cache_key, data, TTL["graph"])
    return ok(data)


@router.get("/{criminal_id}/timeline")
async def criminal_timeline(
    criminal_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> dict[str, Any]:
    """Return chronological events (crimes, comms, transactions, locations)."""
    events: list[dict[str, Any]] = []

    crimes = neo.run_query(
        "MATCH (p:Person {id: $pid})-[:PARTICIPATED_IN]->(c:CrimeEvent) "
        "RETURN c.crime_type AS type, c.date AS date, c.description AS description, c.case_number AS case_number",
        {"pid": criminal_id},
    )
    for c in crimes:
        if c.get("date"):
            events.append({"date": str(c["date"]), "kind": "CRIME",
                           "label": c.get("type"), "detail": c.get("description"),
                           "case_number": c.get("case_number")})

    comms = neo.run_query(
        "MATCH (p:Person {id: $pid})-[c:COMMUNICATED_WITH]->(m:Person) "
        "RETURN m.name AS name, c.last_date AS date, c.frequency AS frequency",
        {"pid": criminal_id},
    )
    for c in comms:
        if c.get("date"):
            events.append({"date": str(c["date"]), "kind": "COMMUNICATION",
                           "label": f"Communicated with {c.get('name')}",
                           "detail": f"frequency: {c.get('frequency')}"})

    transactions = neo.run_query(
        "MATCH (p:Person {id: $pid})-[:OWNS_ACCOUNT]->(a:Account)-[t:TRANSFERRED_TO]->(b:Account) "
        "RETURN t.amount AS amount, t.date AS date, b.account_number AS target",
        {"pid": criminal_id},
    )
    for t in transactions:
        if t.get("date"):
            events.append({"date": str(t["date"]), "kind": "FINANCIAL",
                           "label": f"Transfer ₹{t.get('amount')}", "detail": f"to {t.get('target')}"})

    events.sort(key=lambda e: str(e["date"]), reverse=True)
    return ok({"events": events, "count": len(events)})


@router.get("/{criminal_id}/risk")
async def criminal_risk(criminal_id: str, refresh: bool = False) -> dict[str, Any]:
    """Return risk score, SHAP-style explanations and history."""
    return ok(risk_service.score_criminal(criminal_id, refresh=refresh))


@router.get("/{criminal_id}/predictions")
async def criminal_predictions(criminal_id: str) -> dict[str, Any]:
    """Return the crime prediction report for a criminal."""
    from app.ml_models.crime_predictor import get_crime_predictor

    person = risk_service.get_person(criminal_id)
    if not person:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Criminal not found")
    predictor = get_crime_predictor()
    result = predictor.predict(person, risk_service._network_features(criminal_id))
    return ok(result)


@router.get("/{criminal_id}/anomalies")
async def criminal_anomalies(criminal_id: str) -> dict[str, Any]:
    """Return detected anomalies for a criminal."""
    return ok(anomaly_service.analyze_criminal(criminal_id))
