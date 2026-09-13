"""
Redis cache / session store.

Used for:
  * response caching (criminal profiles, network graphs, risk scores)
  * rate-limit counters
  * active-alert lists and short-lived computed metrics
  * session state

All values are stored as JSON strings with explicit TTLs.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Optional

import redis

from app.config import settings

logger = logging.getLogger("crimenet.redis")

_client: Optional[redis.Redis] = None

# Named TTLs (seconds) matching the spec's cache map.
TTL = {
    "profile": 3600,       # 1 hour
    "graph": 1800,         # 30 minutes
    "risk": 900,           # 15 minutes
    "search": 300,         # 5 minutes
    "pagerank": 86400,     # 24 hours
    "alerts": 60,          # 1 minute
    "session": 86400,      # 24 hours
}


def get_redis() -> redis.Redis:
    """Return the shared Redis client."""
    global _client
    if _client is None:
        _client = redis.Redis.from_url(
            settings.redis_url,
            decode_responses=True,
            socket_connect_timeout=2,
            socket_timeout=2,
        )
        logger.info("Redis client created: %s", settings.redis_url)
    return _client


def cache_get(key: str) -> Optional[Any]:
    """Read and JSON-decode a cached value, or None if absent."""
    try:
        raw = get_redis().get(key)
        return json.loads(raw) if raw is not None else None
    except (redis.RedisError, json.JSONDecodeError) as exc:  # pragma: no cover
        logger.debug("cache_get(%s) failed: %s", key, exc)
        return None


def cache_set(key: str, value: Any, ttl: int) -> None:
    """JSON-encode and store a value with a TTL."""
    try:
        get_redis().setex(key, ttl, json.dumps(value, default=str))
    except redis.RedisError as exc:  # pragma: no cover
        logger.debug("cache_set(%s) failed: %s", key, exc)


def cache_delete(key: str) -> None:
    """Delete a cached key."""
    try:
        get_redis().delete(key)
    except redis.RedisError as exc:  # pragma: no cover
        logger.debug("cache_delete(%s) failed: %s", key, exc)


def invalidate_pattern(pattern: str) -> None:
    """Delete all keys matching a glob pattern (e.g. 'criminal:profile:*')."""
    try:
        keys = list(get_redis().scan_iter(match=pattern, count=500))
        if keys:
            get_redis().delete(*keys)
    except redis.RedisError as exc:  # pragma: no cover
        logger.debug("invalidate_pattern(%s) failed: %s", pattern, exc)


def is_connected() -> bool:
    """Return whether Redis is reachable."""
    try:
        return bool(get_redis().ping())
    except redis.RedisError:  # pragma: no cover
        return False
