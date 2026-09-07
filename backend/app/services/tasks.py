"""
Celery tasks — background processing (report generation, nightly metrics).

The report/network pipelines can be expensive; these tasks let them run
asynchronously off the request path. `run_task` provides a synchronous
fallback so callers work identically without a broker.

Enable a broker by setting CELERY_BROKER_URL (e.g. redis://redis:6379/1) and
running:  celery -A app.services.tasks worker --loglevel=info
"""

from __future__ import annotations

import logging
import os
from typing import Any, Callable, Optional

from celery import Celery

logger = logging.getLogger("crimenet.tasks")

celery_app = Celery(
    "crimenet",
    broker=os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/1"),
    backend=os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/2"),
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_track_started=True,
    worker_max_tasks_per_child=200,
)


@celery_app.task(name="crimenet.generate_report")
def generate_report_async(
    report_type: str, entity_id: str, fmt: str = "PDF", classification: str = "CONFIDENTIAL"
) -> dict[str, Any]:
    """
    Generate a report off the request path.

    Returns the report metadata (file path + id) once complete.
    """
    from app.services import report_service  # noqa: PLC0415

    if report_type == "criminal":
        result = report_service.generate_criminal_report(entity_id, fmt=fmt, classification=classification)
    elif report_type == "network":
        result = report_service.generate_network_report(fmt=fmt, classification=classification)
    elif report_type == "case":
        result = report_service.generate_case_report(entity_id, fmt=fmt, classification=classification)
    else:
        result = report_service.generate_executive_report(fmt=fmt, classification=classification)
    logger.info("Async report generated: %s (%s)", result.get("file_name"), report_type)
    return result


@celery_app.task(name="crimenet.nightly_metrics")
def nightly_metrics() -> dict[str, Any]:
    """
    Pre-compute PageRank / centrality / community metrics for the next day.

    Scheduled via celery-beat; results are cached in Redis (TTL 24h).
    """
    from app.database.redis_connection import cache_set, TTL  # noqa: PLC0415
    from app.services.graph_service import get_key_players, get_statistics  # noqa: PLC0415

    key_players = get_key_players()
    statistics = get_statistics()
    cache_set("metrics:pagerank:latest", key_players, TTL["pagerank"])
    cache_set("metrics:statistics:latest", statistics, TTL["pagerank"])
    logger.info("Nightly metrics computed: %d key players", len(key_players.get("top_pagerank", [])))
    return {"key_players": key_players, "statistics": statistics}


def run_task(fn: Callable[..., Any], *args: Any, **kwargs: Any) -> Any:
    """
    Run a callable directly when Celery is unavailable (dev/CI fallback).

    Usage:  run_task(generate_report_async, "criminal", "cr-001")
    """
    if os.getenv("CELERY_BROKER_URL"):
        try:
            celery_app.connection().ensure_connection(max_retries=1)
            return fn.delay(*args, **kwargs)  # type: ignore[attr-defined]
        except Exception as exc:  # noqa: BLE001
            logger.debug("Celery broker unreachable (%s); running inline", exc)
    return fn(*args, **kwargs)
