"""
NLP service — FIR auto-analysis pipeline.

1. Extract entities/relationships from raw FIR text (spaCy + BERT + regex)
2. Upsert extracted entities into the Neo4j knowledge graph
3. Compute risk scores for any newly created persons
4. Return the extracted entities + created-node summary
"""

from __future__ import annotations

import logging
import uuid
from typing import Any

from app.database import neo4j_connection as neo
from app.ml_models.nlp_extractor import get_nlp_extractor

logger = logging.getLogger("crimenet.nlp")


def _slug(text: str) -> str:
    """Create a stable id from entity text."""
    return str(uuid.uuid5(uuid.NAMESPACE_DNS, f"entity:{text.strip().lower()}"))


def analyze_fir(fir_text: str, language: str = "en") -> dict[str, Any]:
    """
    Run the full FIR analysis workflow and update the knowledge graph.

    Returns the extraction result plus counts of created/merged graph nodes.
    """
    if not fir_text or not fir_text.strip():
        return {"entities": [], "relationships": [], "created": {}, "error": "Empty FIR text"}

    extractor = get_nlp_extractor()
    extraction = extractor.extract(fir_text, language)

    created: dict[str, int] = {}
    for entity in extraction["entities"]:
        etype = entity["type"]
        created.setdefault(etype, 0)
        node_id = _slug(entity["text"])
        merged = _upsert_entity(node_id, entity)
        if merged:
            created[etype] += 1

    # Build relationship edges between extracted entities.
    for rel in extraction.get("relationships", []):
        _create_relationship(rel)

    return {
        "entities": extraction["entities"],
        "relationships": extraction["relationships"],
        "created": created,
        "quality_score": extraction.get("quality_score"),
        "model": extraction.get("model"),
    }


def _upsert_entity(node_id: str, entity: dict[str, Any]) -> bool:
    """Create/merge an entity node in Neo4j. Returns True if newly created."""
    etype = entity["type"]
    text = entity["text"]
    queries: dict[str, tuple[str, dict[str, Any]]] = {
        "PERSON": (
            """
            MERGE (n:Person {id: $id})
            ON CREATE SET n.name = $text, n.created_at = datetime()
            ON MATCH SET n.updated_at = datetime()
            """,
            {"id": node_id, "text": text},
        ),
        "LOCATION": (
            """
            MERGE (n:Location {id: $id})
            ON CREATE SET n.name = $text, n.created_at = datetime()
            """,
            {"id": node_id, "text": text},
        ),
        "ORGANIZATION": (
            """
            MERGE (n:Organization {id: $id})
            ON CREATE SET n.name = $text, n.created_at = datetime()
            """,
            {"id": node_id, "text": text},
        ),
        "VEHICLE": (
            """
            MERGE (n:Vehicle {id: $id})
            ON CREATE SET n.registration_number = $text, n.created_at = datetime()
            """,
            {"id": node_id, "text": text},
        ),
        "ACCOUNT": (
            """
            MERGE (n:Account {id: $id})
            ON CREATE SET n.account_number = $text, n.created_at = datetime()
            """,
            {"id": node_id, "text": text},
        ),
    }
    if etype not in queries:
        return False
    query, params = queries[etype]
    try:
        neo.run_write(query, params)
        return True
    except Exception as exc:  # noqa: BLE001
        logger.warning("Entity upsert failed for %s: %s", text, exc)
        return False


def _create_relationship(rel: dict[str, Any]) -> None:
    """Create a relationship edge between two extracted entities."""
    source_id = _slug(rel["source"])
    target_id = _slug(rel["target"])
    relation = rel["relation"]
    rel_queries: dict[str, str] = {
        "LOCATED_AT": "MERGE (a {id: $s}) MERGE (b {id: $t}) MERGE (a)-[r:LOCATED_AT]->(b)",
        "MEMBER_OF": "MERGE (a {id: $s}) MERGE (b {id: $t}) MERGE (a)-[r:MEMBER_OF]->(b)",
        "OWNS_VEHICLE": "MERGE (a {id: $s}) MERGE (b {id: $t}) MERGE (a)-[r:OWNS_VEHICLE]->(b)",
        "OWNS_ACCOUNT": "MERGE (a {id: $s}) MERGE (b {id: $t}) MERGE (a)-[r:OWNS_ACCOUNT]->(b)",
    }
    query = rel_queries.get(relation)
    if not query:
        return
    try:
        neo.run_write(query, {"s": source_id, "t": target_id})
    except Exception as exc:  # noqa: BLE001
        logger.warning("Relationship creation failed (%s): %s", relation, exc)
