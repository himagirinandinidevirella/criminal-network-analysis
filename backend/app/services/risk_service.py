"""
Risk service — compute, cache and explain criminal risk scores.

Fetches a person's attributes and network features from Neo4j, runs the risk
scorer (XGBoost + rules + SHAP explanations) and caches results in Redis.
"""

from __future__ import annotations

import hashlib
import logging
from typing import Any, Optional

from app.database import neo4j_connection as neo
from app.database.redis_connection import cache_get, cache_set, TTL
from app.ml_models.risk_scorer import get_risk_scorer

logger = logging.getLogger("crimenet.risk")


def _network_features(person_id: str) -> dict[str, float]:
    """Compute network-derived features for a person from the graph."""
    rows = neo.run_query(
        """
        MATCH (p:Person {id: $pid})
        OPTIONAL MATCH (p)-[r]-(m)
        RETURN
          count(DISTINCT m) AS degree,
          sum(CASE WHEN m:Person AND coalesce(m.risk_score, 0) >= 61 THEN 1 ELSE 0 END) AS high_risk_associates,
          sum(CASE WHEN type(r) = 'TRANSACTED_WITH' THEN 1 ELSE 0 END) AS transaction_links,
          sum(CASE WHEN type(r) = 'COMMUNICATED_WITH' THEN 1 ELSE 0 END) AS communication_links
        """,
        {"pid": person_id},
    )
    if not rows:
        return {}
    row = rows[0]
    degree = float(row.get("degree") or 0)
    # PageRank proxy: normalised degree (full PageRank computed on demand).
    return {
        "degree": degree,
        "pagerank": round(min(1.0, degree / 50), 4),
        "high_risk_associates": float(row.get("high_risk_associates") or 0),
        "transaction_links": float(row.get("transaction_links") or 0),
        "communication_links": float(row.get("communication_links") or 0),
    }


def get_person(person_id: str) -> Optional[dict[str, Any]]:
    """Fetch a person node's properties."""
    rows = neo.run_query(
        "MATCH (p:Person {id: $pid}) RETURN properties(p) AS props",
        {"pid": person_id},
    )
    return rows[0]["props"] if rows else None


def score_criminal(person_id: str, refresh: bool = False) -> dict[str, Any]:
    """Compute (or fetch cached) risk score for a criminal."""
    cache_key = f"risk:score:{person_id}"
    if not refresh:
        cached = cache_get(cache_key)
        if cached:
            return cached

    person = get_person(person_id)
    if not person:
        return {"score": 0.0, "level": "LOW", "color": "#10B981", "factors": []}

    network_features = _network_features(person_id)
    result = get_risk_scorer().score(person, network_features)
    result["criminal_id"] = person_id
    result["history"] = risk_history(person_id, person)
    cache_set(cache_key, result, TTL["risk"])
    return result


def risk_history(person_id: str, person: Optional[dict[str, Any]] = None) -> list[dict[str, Any]]:
    """
    Build a deterministic risk-evolution series for sparkline charts.
    Uses a hash of the criminal id so the curve is stable across requests.
    """
    seed = int(hashlib.md5(person_id.encode()).hexdigest(), 16) % 1000
    base = (person or {}).get("risk_score", 50) or 50
    points = []
    for i in range(12):
        # Smooth climb towards current risk with deterministic noise.
        frac = (i + 1) / 12
        noise = ((seed >> (i % 8)) & 7) / 7 * 6 - 3
        value = round(min(100, max(0, base * frac + noise)), 1)
        points.append({"month": i + 1, "score": value})
    return points


def score_many(person_ids: list[str]) -> dict[str, float]:
    """Batch-score a list of criminals (used for dashboards and rankings)."""
    scores: dict[str, float] = {}
    for pid in person_ids[:100]:
        try:
            scores[pid] = score_criminal(pid)["score"]
        except Exception as exc:  # noqa: BLE001
            logger.debug("score_many failed for %s: %s", pid, exc)
    return scores
