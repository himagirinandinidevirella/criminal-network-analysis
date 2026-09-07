"""
CrimeNet AI — FastAPI application entrypoint.

Assembles:
  * CORS, security-header and audit middlewares
  * JWT auth, rate limiting
  * All API routers (auth, criminals, network, alerts, reports, search,
    chatbot, actions, export, public)
  * Real-time alert WebSocket at /ws/alerts
  * Startup: connect databases, load ML models, seed synthetic data
  * Health check and global exception handling
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.api.middleware.audit_logger import AuditLogMiddleware
from app.api.middleware.cors_handler import configure_cors
from app.api.routes import actions, alerts, auth, blockchain, chatbot, criminal, cybercrime, demo, export, network, public, reports, search
from app.api.routes import fail
from app.config import settings
from app.database import neo4j_connection, postgres_connection, redis_connection
from app.websocket.alert_websocket import manager

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger("crimenet.main")


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add common security headers to every response."""

    async def dispatch(self, request: Request, call_next):  # noqa: ANN001
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "no-referrer"
        return response


def _connect_databases() -> dict[str, bool]:
    """Attempt to connect all three data stores; report per-store status."""
    status = {
        "neo4j": False,
        "postgres": False,
        "redis": False,
    }
    try:
        neo4j_connection.get_driver()
        status["neo4j"] = neo4j_connection.is_connected()
    except Exception as exc:  # noqa: BLE001
        logger.error("Neo4j startup failed: %s", exc)
    try:
        postgres_connection.get_pool()
        status["postgres"] = postgres_connection.is_connected()
    except Exception as exc:  # noqa: BLE001
        logger.error("PostgreSQL startup failed: %s", exc)
    try:
        redis_connection.get_redis()
        status["redis"] = redis_connection.is_connected()
    except Exception as exc:  # noqa: BLE001
        logger.error("Redis startup failed: %s", exc)
    return status


def _load_ml_models() -> None:
    """Warm up ML models if enabled (heavy: BERT, XGBoost, GNN)."""
    if not settings.ml_load_models:
        logger.info("ML model loading disabled (ML_LOAD_MODELS=false)")
        return
    # Load fast models first (XGBoost, IsolationForest)
    try:
        from app.ml_models.risk_scorer import get_risk_scorer

        scorer = get_risk_scorer()
        logger.info("Risk scorer loaded (engine=%s)", "xgboost+rules" if scorer.has_xgboost() else "rules")
    except Exception as exc:  # noqa: BLE001
        logger.warning("Risk scorer could not be loaded: %s", exc)
    try:
        from app.ml_models.anomaly_detector import get_anomaly_detector

        get_anomaly_detector()
        logger.info("Anomaly detector loaded")
    except Exception as exc:  # noqa: BLE001
        logger.warning("Anomaly detector could not be loaded: %s", exc)
    # NLP extractor (may download BERT; loaded lazily on first call to avoid blocking startup)
    try:
        from app.ml_models.nlp_extractor import get_nlp_extractor

        get_nlp_extractor()
        logger.info("NLP extractor loaded")
    except Exception as exc:  # noqa: BLE001
        logger.warning("NLP extractor deferred: %s", exc)


def _seed_data() -> None:
    """Load synthetic demo data and demo users when enabled."""
    if not settings.load_synthetic_data:
        logger.info("Synthetic data loading disabled (LOAD_SYNTHETIC_DATA=false)")
        return
    try:
        from data.synthetic_data_generator import ensure_demo_data

        ensure_demo_data()
        logger.info("Synthetic data ensured")
    except Exception as exc:  # noqa: BLE001
        logger.warning("Synthetic data seeding skipped: %s", exc)


def _warmup_blockchain() -> None:
    """Initialise the blockchain connector (web3 or local ledger fallback)."""
    try:
        from app.blockchain.web3_connector import get_web3_connector

        connector = get_web3_connector()
        logger.info("Blockchain layer ready (mode=%s)", connector.mode)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Blockchain layer unavailable: %s", exc)


@asynccontextmanager
async def lifespan(app: FastAPI):  # noqa: ANN001
    """Application lifespan: initialise on startup, clean up on shutdown."""
    logger.info("Starting %s (%s)", settings.app_name, settings.environment)
    _connect_databases()
    _load_ml_models()
    _seed_data()
    _warmup_blockchain()
    logger.info("CrimeNet AI is ready")
    yield
    # Graceful shutdown
    neo4j_connection.close_driver()
    postgres_connection.close_pool()
    logger.info("CrimeNet AI shut down")


app = FastAPI(
    title="CrimeNet AI — Criminal Network Analysis System",
    description=(
        "AI-powered criminal network intelligence platform for law enforcement "
        "(SIH 2025). Entity extraction, knowledge graph, risk scoring, anomaly "
        "detection and crime prediction."
    ),
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── Middleware ────────────────────────────────────────────────────────────────
configure_cors(app)
app.add_middleware(AuditLogMiddleware)
app.add_middleware(SecurityHeadersMiddleware)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(criminal.router, prefix="/api/criminals", tags=["Criminals"])
app.include_router(network.router, prefix="/api/network", tags=["Network"])
app.include_router(alerts.router, prefix="/api/alerts", tags=["Alerts"])
app.include_router(reports.router, prefix="/api/reports", tags=["Reports"])
app.include_router(search.router, prefix="/api/search", tags=["Search"])
app.include_router(chatbot.router, prefix="/api/chat", tags=["Chatbot"])
app.include_router(actions.router, prefix="/api/actions", tags=["Actions"])
app.include_router(export.router, prefix="/api/export", tags=["Export"])
app.include_router(public.router, prefix="/api/public", tags=["Public"])
app.include_router(demo.router, prefix="/api/demo", tags=["Demo"])
app.include_router(blockchain.router, prefix="/api/blockchain", tags=["Blockchain"])
app.include_router(cybercrime.router, prefix="/api/cybercrime", tags=["CyberCrime"])


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/health")
async def health() -> dict[str, Any]:
    """Liveness/readiness probe used by Docker health checks and the UI."""
    db_status = _connect_databases() if False else {
        "neo4j": neo4j_connection.is_connected(),
        "postgres": postgres_connection.is_connected(),
        "redis": redis_connection.is_connected(),
    }
    all_ok = all(db_status.values())
    return {
        "success": all_ok,
        "data": {
            "status": "healthy" if all_ok else "degraded",
            "databases": db_status,
            "app": settings.app_name,
            "version": "1.0.0",
        },
        "message": "CrimeNet AI is running",
        "error": None,
        "timestamp": __import__("datetime").datetime.now(
            __import__("datetime").timezone.utc
        ).isoformat(),
    }


# ── Real-time alerts WebSocket ────────────────────────────────────────────────
@app.websocket("/ws/alerts")
async def alerts_websocket(websocket: WebSocket, token: str | None = None) -> None:
    """Authenticated WebSocket for live alert push."""
    user = await manager.connect(websocket, token)
    if user is None:
        return
    try:
        while True:
            message = await websocket.receive_json()
            msg_type = message.get("type")
            if msg_type == "subscribe":
                ids = message.get("criminal_ids", [])
                manager.subscribe(websocket, ids)
                await websocket.send_json({"type": "subscribed", "data": ids})
            elif msg_type == "unsubscribe":
                ids = message.get("criminal_ids", [])
                manager.unsubscribe(websocket, ids)
                await websocket.send_json({"type": "unsubscribed", "data": ids})
            elif msg_type == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        manager.disconnect(websocket)


# ── Global exception handlers ─────────────────────────────────────────────────
@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:  # noqa: ANN001
    """Catch-all handler returning the standard error envelope."""
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content=fail("Internal server error", error=str(exc)),
    )
