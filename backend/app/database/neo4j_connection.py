"""
Neo4j graph database connection manager.

Exposes a single lazily-initialised driver and thin query helpers used by the
graph service and synthetic data loader. Indexes and full-text search indexes
are created on first connection to keep queries fast.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Optional

from neo4j import Driver, GraphDatabase
from neo4j.exceptions import ServiceUnavailable

from app.config import settings

logger = logging.getLogger("crimenet.neo4j")

_driver: Optional[Driver] = None

# Indexes for frequently queried node properties.
INDEX_QUERIES: list[str] = [
    "CREATE INDEX person_id_idx IF NOT EXISTS FOR (p:Person) ON (p.id)",
    "CREATE INDEX person_name_idx IF NOT EXISTS FOR (p:Person) ON (p.name)",
    "CREATE INDEX person_criminal_id_idx IF NOT EXISTS FOR (p:Person) ON (p.criminal_id)",
    "CREATE INDEX person_risk_idx IF NOT EXISTS FOR (p:Person) ON (p.risk_score)",
    "CREATE INDEX org_id_idx IF NOT EXISTS FOR (o:Organization) ON (o.id)",
    "CREATE INDEX org_name_idx IF NOT EXISTS FOR (o:Organization) ON (o.name)",
    "CREATE INDEX vehicle_id_idx IF NOT EXISTS FOR (v:Vehicle) ON (v.id)",
    "CREATE INDEX vehicle_reg_idx IF NOT EXISTS FOR (v:Vehicle) ON (v.registration_number)",
    "CREATE INDEX account_id_idx IF NOT EXISTS FOR (a:Account) ON (a.id)",
    "CREATE INDEX account_number_idx IF NOT EXISTS FOR (a:Account) ON (a.account_number)",
    "CREATE INDEX location_id_idx IF NOT EXISTS FOR (l:Location) ON (l.id)",
    "CREATE INDEX location_name_idx IF NOT EXISTS FOR (l:Location) ON (l.name)",
    "CREATE INDEX crime_id_idx IF NOT EXISTS FOR (c:CrimeEvent) ON (c.id)",
    "CREATE INDEX crime_case_idx IF NOT EXISTS FOR (c:CrimeEvent) ON (c.case_number)",
    "CREATE INDEX tx_id_idx IF NOT EXISTS FOR (t:Transaction) ON (t.id)",
]

# Full-text search index for name/alias/description lookups.
FULLTEXT_QUERY: str = (
    "CREATE FULLTEXT INDEX entitySearch IF NOT EXISTS "
    "FOR (p:Person) ON EACH [p.name, p.aliases] "
    "OPTIONS { indexConfig: { `fulltext.analyzer`: 'standard' } }"
)


def get_driver() -> Driver:
    """Return the shared Neo4j driver, creating and verifying it once."""
    global _driver
    if _driver is None:
        _driver = GraphDatabase.driver(
            settings.neo4j_uri,
            auth=(settings.neo4j_user, settings.neo4j_password),
            max_connection_lifetime=3600,
            connection_acquisition_timeout=30,
        )
        try:
            _driver.verify_connectivity()
            logger.info("Neo4j connected: %s", settings.neo4j_uri)
            _ensure_indexes()
        except ServiceUnavailable as exc:  # pragma: no cover - env specific
            logger.error("Neo4j unavailable at %s: %s", settings.neo4j_uri, exc)
            raise
    return _driver


def close_driver() -> None:
    """Close the driver (used during graceful shutdown)."""
    global _driver
    if _driver is not None:
        _driver.close()
        _driver = None
        logger.info("Neo4j driver closed")


def _ensure_indexes() -> None:
    """Create schema indexes if they do not exist yet."""
    try:
        with get_driver().session(database=settings.neo4j_database) as session:
            for query in INDEX_QUERIES:
                session.run(query)
            session.run(FULLTEXT_QUERY)
        logger.info("Neo4j indexes ensured")
    except Exception as exc:  # pragma: no cover
        logger.warning("Could not create Neo4j indexes: %s", exc)


def _jsonify(value: Any) -> Any:
    """Recursively convert values JSON/Pydantic cannot serialise (neo4j.time.*,
    bytes, ...) to strings. Neo4j DateTime/Date/Time nodes break FastAPI
    responses with 'Unable to serialize unknown type' otherwise."""
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, dict):
        return {k: _jsonify(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_jsonify(v) for v in value]
    try:
        json.dumps(value)
        return value
    except (TypeError, ValueError):
        return str(value)


def run_query(query: str, parameters: Optional[dict[str, Any]] = None) -> list[dict[str, Any]]:
    """Execute a read query and return a list of JSON-safe record dicts."""
    driver = get_driver()
    with driver.session(database=settings.neo4j_database) as session:
        result = session.run(query, parameters or {})
        return [_jsonify(record.data()) for record in result]


def run_write(query: str, parameters: Optional[dict[str, Any]] = None) -> list[dict[str, Any]]:
    """Execute a write query inside a transaction and return JSON-safe records."""
    driver = get_driver()

    def _work(tx: Any) -> list[dict[str, Any]]:
        return [_jsonify(record.data()) for record in tx.run(query, parameters or {})]

    with driver.session(database=settings.neo4j_database) as session:
        return session.execute_write(_work)


def run_many(queries: list[tuple[str, dict[str, Any]]]) -> list[dict[str, Any]]:
    """Run many write statements inside a single transaction (for bulk loads)."""
    driver = get_driver()

    def _work(tx: Any) -> list[dict[str, Any]]:
        out: list[dict[str, Any]] = []
        for query, params in queries:
            out.extend(record.data() for record in tx.run(query, params))
        return out

    with driver.session(database=settings.neo4j_database) as session:
        return session.execute_write(_work)


def is_connected() -> bool:
    """Return whether Neo4j is currently reachable."""
    try:
        get_driver().verify_connectivity()
        return True
    except Exception:  # pragma: no cover
        return False
