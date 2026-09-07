"""
Anomaly service — runs the six anomaly detectors over a criminal's data and
raises alerts for high/medium findings.

Data sources are read from Neo4j (transactions, CDR/communication links,
location events, crime history) and passed to the anomaly detection engine.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

from app.database import neo4j_connection as neo
from app.ml_models.anomaly_detector import get_anomaly_detector

logger = logging.getLogger("crimenet.anomaly")


def _transactions_for(person_id: str) -> list[dict[str, Any]]:
    """Fetch the financial transactions linked to a person/their accounts."""
    rows = neo.run_query(
        """
        MATCH (p:Person {id: $pid})
        OPTIONAL MATCH (p)-[:OWNS_ACCOUNT]->(a:Account)
        OPTIONAL MATCH (a)-[t:TRANSFERRED_TO]->(:Account)
        RETURN
          coalesce(t.amount, a.total_suspicious_amount, 0) AS amount,
          t.type AS type,
          t.date AS date,
          a.currency AS currency,
          a.flagged AS flagged
        """,
        {"pid": person_id},
    )
    return [
        {
            "amount": r.get("amount") or 0,
            "type": r.get("type") or "TRANSFER",
            "date": r.get("date"),
            "currency": r.get("currency") or "INR",
            "flagged": r.get("flagged"),
        }
        for r in rows
    ]


def _communications_for(person_id: str) -> list[dict[str, Any]]:
    """Fetch communication links for the person."""
    rows = neo.run_query(
        """
        MATCH (p:Person {id: $pid})-[c:COMMUNICATED_WITH]->(m:Person)
        RETURN m.name AS target, c.frequency AS frequency, c.last_date AS last_date
        """,
        {"pid": person_id},
    )
    return [
        {"target": r.get("target"), "frequency": r.get("frequency"),
         "last_date": r.get("last_date")}
        for r in rows
    ]


def _location_events_for(person_id: str) -> list[dict[str, Any]]:
    """Fetch location events for the person."""
    rows = neo.run_query(
        """
        MATCH (p:Person {id: $pid})-[l:LOCATED_AT]->(loc:Location)
        RETURN loc.name AS location, loc.hotspot_score AS hotspot_score
        """,
        {"pid": person_id},
    )
    return [
        {
            "location": r.get("location"),
            "hotspot": (r.get("hotspot_score") or 0) > 0.6,
        }
        for r in rows
    ]


def analyze_criminal(person_id: str) -> dict[str, Any]:
    """
    Run all anomaly detectors for a person and return findings with the
    alerts that would be raised.
    """
    detector = get_anomaly_detector()

    transactions = _transactions_for(person_id)
    communications = _communications_for(person_id)
    locations = _location_events_for(person_id)

    # Temporal series from communication frequencies.
    series = [float(c.get("frequency") or 0) for c in communications]

    # Behavioural history derived from crime events.
    crimes = neo.run_query(
        """
        MATCH (p:Person {id: $pid})-[:PARTICIPATED_IN]->(c:CrimeEvent)
        RETURN c.crime_type AS crime_type, c.severity AS severity
        ORDER BY c.date DESC
        """,
        {"pid": person_id},
    )
    history = {
        "escalation": len(crimes) >= 2 and any(
            c.get("severity") in ("HIGH", "CRITICAL") for c in crimes
        ),
        "violence_increase": any(
            c.get("crime_type", "").lower() in {"armed robbery", "murder", "kidnapping"}
            for c in crimes
        ),
        "target_change": len({c.get("crime_type") for c in crimes}) >= 3,
    }

    anomalies = detector.detect_all(
        transactions=transactions,
        cdr_records=communications,
        location_events=locations,
        graph_delta={},
        temporal_series=series,
        history=history,
    )

    # Raise alerts for high severity anomalies.
    raised: list[dict[str, Any]] = []
    try:
        from app.services.alert_service import create_alert

        for anomaly in anomalies:
            if anomaly["severity"] in ("HIGH", "CRITICAL"):
                raised.append(create_alert(
                    title=f"{anomaly['type'].title()} anomaly detected",
                    description="; ".join(anomaly.get("reasons", [])),
                    severity=anomaly["severity"],
                    category=anomaly["type"],
                    criminal_id=person_id,
                ))
    except Exception as exc:  # noqa: BLE001
        logger.warning("Alert creation failed during analysis: %s", exc)

    return {"anomalies": anomalies, "alerts_raised": raised}
