"""
Streaming pipeline — Apache Kafka real-time ingestion (Step 2c).

Ingests CDR records, financial transactions and FIR events in real time, with
automatic deduplication. Uses `kafka-python` when a broker is reachable and
degrades to an in-process pub/sub bus otherwise, so the API keeps working in
every environment (local dev, CI, and Docker where Kafka may be added).

Enable Kafka by pointing KAFKA_BOOTSTRAP_SERVERS at a broker (e.g. add a
`kafka` service to docker-compose.yml).
"""

from __future__ import annotations

import json
import logging
import threading
from collections import deque
from typing import Any, Callable, Optional

logger = logging.getLogger("crimenet.stream")


def _env(key: str, default: str) -> str:
    """Read an environment variable with a default."""
    import os

    return os.getenv(key, default)


KAFKA_BOOTSTRAP = _env("KAFKA_BOOTSTRAP_SERVERS", "")
TOPIC_CDR = "crimenet.cdr"
TOPIC_TRANSACTIONS = "crimenet.transactions"
TOPIC_FIR = "crimenet.fir"

# Simple in-process fallback bus (topic -> list of subscribers).
_fallback_subs: dict[str, list[Callable[[dict[str, Any]], None]]] = {}
_seen_hashes: deque[str] = deque(maxlen=5000)  # dedup window


class StreamIngestor:
    """
    Publishes and consumes stream events.

    When Kafka is available the events flow through real topics; otherwise the
    in-process bus keeps the API functional for demos and tests.
    """

    def __init__(self, bootstrap: Optional[str] = None) -> None:
        self.bootstrap = bootstrap or KAFKA_BOOTSTRAP
        self._producer: Optional[Any] = None
        self._consumer: Optional[Any] = None
        if self.bootstrap:
            self._init_kafka()

    # ── Kafka setup ───────────────────────────────────────────────────────────
    def _init_kafka(self) -> None:
        try:
            from kafka import KafkaConsumer, KafkaProducer  # noqa: PLC0415

            self._producer = KafkaProducer(
                bootstrap_servers=self.bootstrap,
                value_serializer=lambda v: json.dumps(v).encode("utf-8"),
                acks=1,
            )
            self._consumer = KafkaConsumer(
                TOPIC_CDR, TOPIC_TRANSACTIONS, TOPIC_FIR,
                bootstrap_servers=self.bootstrap,
                auto_offset_reset="latest",
                value_deserializer=lambda m: json.loads(m.decode("utf-8")),
            )
            logger.info("Kafka streaming enabled at %s", self.bootstrap)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Kafka unavailable (%s); using in-process bus", exc)
            self._producer = None
            self._consumer = None

    # ── Publish ───────────────────────────────────────────────────────────────
    def publish(self, topic: str, event: dict[str, Any]) -> bool:
        """Publish an event to a topic. Returns True if accepted."""
        if not self._dedupe(event):
            return False
        if self._producer is not None:
            try:
                self._producer.send(topic, event)
                return True
            except Exception as exc:  # noqa: BLE001
                logger.debug("Kafka send failed: %s", exc)
        # In-process fallback.
        for sub in _fallback_subs.get(topic, []):
            try:
                sub(event)
            except Exception as exc:  # noqa: BLE001
                logger.debug("Subscriber failed: %s", exc)
        return True

    # ── Subscribe ─────────────────────────────────────────────────────────────
    def subscribe(self, topic: str, callback: Callable[[dict[str, Any]], None]) -> None:
        """Register a callback for a topic."""
        _fallback_subs.setdefault(topic, []).append(callback)

    def start_consuming(self) -> None:
        """Start consuming Kafka topics in a background thread (Kafka only)."""
        if self._consumer is None:
            return
        thread = threading.Thread(target=self._consume_loop, daemon=True)
        thread.start()

    def _consume_loop(self) -> None:
        try:
            for message in self._consumer:
                for sub in _fallback_subs.get(message.topic, []):
                    try:
                        sub(message.value)
                    except Exception as exc:  # noqa: BLE001
                        logger.debug("Subscriber failed: %s", exc)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Kafka consumer stopped: %s", exc)

    # ── Deduplication ─────────────────────────────────────────────────────────
    @staticmethod
    def _dedupe(event: dict[str, Any]) -> bool:
        """Automatic deduplication on a stable event hash."""
        import hashlib

        digest = hashlib.md5(json.dumps(event, sort_keys=True, default=str).encode()).hexdigest()
        if digest in _seen_hashes:
            return False
        _seen_hashes.append(digest)
        return True


# ── Module-level singleton ────────────────────────────────────────────────────
_ingestor: Optional[StreamIngestor] = None


def get_stream() -> StreamIngestor:
    """Return the shared stream ingestor."""
    global _ingestor
    if _ingestor is None:
        _ingestor = StreamIngestor()
        _ingestor.start_consuming()
    return _ingestor


# ── High-level helpers ────────────────────────────────────────────────────────
def ingest_cdr(cdr: dict[str, Any]) -> bool:
    """Ingest one Call Detail Record."""
    return get_stream().publish(TOPIC_CDR, cdr)


def ingest_transaction(tx: dict[str, Any]) -> bool:
    """Ingest one financial transaction."""
    return get_stream().publish(TOPIC_TRANSACTIONS, tx)


def ingest_fir(fir: dict[str, Any]) -> bool:
    """Ingest one FIR event."""
    return get_stream().publish(TOPIC_FIR, fir)
