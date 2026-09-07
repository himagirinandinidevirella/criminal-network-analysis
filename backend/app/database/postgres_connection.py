"""
PostgreSQL relational store.

Stores operational data that does not belong in the graph database:
users, audit logs, case files, evidence, notes, shared reports, alert rules,
report history and saved searches.

Uses a psycopg2 threaded connection pool with parameterised queries only
(SQL-injection safe). The schema is created idempotently on first use.
"""

from __future__ import annotations

import logging
from contextlib import contextmanager
from typing import Any, Iterator, Optional

import psycopg2
from psycopg2.pool import ThreadedConnectionPool

from app.config import settings

logger = logging.getLogger("crimenet.postgres")

_pool: Optional[ThreadedConnectionPool] = None

# ── Idempotent schema ────────────────────────────────────────────────────────
SCHEMA_SQL: str = """
CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    badge_id      VARCHAR(64) UNIQUE NOT NULL,
    name          VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(32)  NOT NULL DEFAULT 'OFFICER',
    department    VARCHAR(128),
    email         VARCHAR(255),
    active        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id          SERIAL PRIMARY KEY,
    user_id     VARCHAR(64),
    action      VARCHAR(128) NOT NULL,
    target_id   VARCHAR(128),
    target_type VARCHAR(64),
    ip_address  VARCHAR(64),
    timestamp   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS case_files (
    id          SERIAL PRIMARY KEY,
    case_number VARCHAR(64) UNIQUE NOT NULL,
    title       VARCHAR(255),
    assigned_to VARCHAR(64),
    status      VARCHAR(32) DEFAULT 'OPEN',
    priority    VARCHAR(16) DEFAULT 'MEDIUM',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS evidence (
    id               SERIAL PRIMARY KEY,
    criminal_id      VARCHAR(64),
    file_url         TEXT NOT NULL,
    file_type        VARCHAR(32),
    uploaded_by      VARCHAR(64),
    chain_of_custody TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notes (
    id          SERIAL PRIMARY KEY,
    criminal_id VARCHAR(64) NOT NULL,
    officer_id  VARCHAR(64),
    content     TEXT NOT NULL,
    note_type   VARCHAR(32) DEFAULT 'GENERAL',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shared_reports (
    id           SERIAL PRIMARY KEY,
    report_id    VARCHAR(64) NOT NULL,
    token        VARCHAR(128) UNIQUE NOT NULL,
    expiry       TIMESTAMPTZ,
    access_level VARCHAR(16) DEFAULT 'VIEW',
    created_by   VARCHAR(64),
    access_count INTEGER NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS alert_rules (
    id              SERIAL PRIMARY KEY,
    rule_name       VARCHAR(128) NOT NULL,
    conditions_json TEXT NOT NULL,
    notify_to       VARCHAR(64),
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_by      VARCHAR(64),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS report_history (
    id           SERIAL PRIMARY KEY,
    report_type  VARCHAR(64) NOT NULL,
    entity_id    VARCHAR(128),
    format       VARCHAR(16) DEFAULT 'PDF',
    generated_by VARCHAR(64),
    file_url     TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS saved_searches (
    id           SERIAL PRIMARY KEY,
    user_id      VARCHAR(64) NOT NULL,
    query        TEXT NOT NULL,
    filters_json TEXT,
    name         VARCHAR(128),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS alerts (
    id            SERIAL PRIMARY KEY,
    title         VARCHAR(255) NOT NULL,
    description   TEXT,
    severity      VARCHAR(16) NOT NULL DEFAULT 'MEDIUM',
    category      VARCHAR(32) NOT NULL DEFAULT 'GENERAL',
    criminal_id   VARCHAR(64),
    criminal_name VARCHAR(255),
    source        VARCHAR(32) DEFAULT 'SYSTEM',
    status        VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    assigned_to   VARCHAR(64),
    resolution    TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
"""


def get_pool() -> ThreadedConnectionPool:
    """Return the shared connection pool, creating it on first call."""
    global _pool
    if _pool is None:
        _pool = ThreadedConnectionPool(
            minconn=2,
            maxconn=20,
            dsn=settings.postgres_url,
        )
        logger.info("PostgreSQL pool created")
        _init_schema()
    return _pool


def close_pool() -> None:
    """Close the connection pool (graceful shutdown)."""
    global _pool
    if _pool is not None:
        _pool.closeall()
        _pool = None
        logger.info("PostgreSQL pool closed")


def _init_schema() -> None:
    """Create tables if they do not exist."""
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(SCHEMA_SQL)
        conn.commit()
    logger.info("PostgreSQL schema ensured")


@contextmanager
def get_conn() -> Iterator[psycopg2.extensions.connection]:
    """Yield a connection from the pool, returning it afterwards."""
    pool = get_pool()
    conn = pool.getconn()
    try:
        yield conn
    finally:
        pool.putconn(conn)


def fetch_all(query: str, params: Optional[tuple] = None) -> list[dict[str, Any]]:
    """Run a SELECT query and return all rows as dicts."""
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(query, params)
                columns = [desc[0] for desc in cur.description] if cur.description else []
                return [dict(zip(columns, row)) for row in cur.fetchall()]
    except Exception as exc:
        logger.debug("PostgreSQL fetch_all unavailable: %s", exc)
        return []


def fetch_one(query: str, params: Optional[tuple] = None) -> Optional[dict[str, Any]]:
    """Run a SELECT query and return a single row as a dict (or None)."""
    rows = fetch_all(query, params)
    return rows[0] if rows else None


def execute(query: str, params: Optional[tuple] = None) -> int:
    """Run an INSERT/UPDATE/DELETE and return the affected row count."""
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(query, params)
                conn.commit()
                return cur.rowcount
    except Exception as exc:
        logger.debug("PostgreSQL execute unavailable: %s", exc)
        return 0


def execute_returning_id(query: str, params: Optional[tuple] = None) -> Optional[int]:
    """Run an INSERT ... RETURNING id and return the new row id."""
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(query, params)
                row = cur.fetchone()
                conn.commit()
                return row[0] if row else None
    except Exception as exc:
        logger.debug("PostgreSQL execute_returning_id unavailable: %s", exc)
        return None


def is_connected() -> bool:
    """Return whether PostgreSQL is reachable."""
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1 AS ok")
                return True
    except Exception:  # pragma: no cover
        return False
