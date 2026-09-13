"""
Chatbot routes.

POST /api/chat/message          — process a natural-language query
GET  /api/chat/history/{session_id} — conversation history
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.api.middleware.auth_middleware import get_current_user
from app.api.routes import ok
from app.database import neo4j_connection as neo
from app.database.redis_connection import cache_get, cache_set, TTL
from app.services import risk_service

logger = logging.getLogger("crimenet.chatbot")
router = APIRouter(dependencies=[Depends(get_current_user)])


class ChatMessage(BaseModel):
    message: str = Field(..., min_length=1)
    session_id: Optional[str] = None
    context: list[dict[str, Any]] = Field(default_factory=list)


# ── Intent handlers ───────────────────────────────────────────────────────────
def _jsonify(obj: Any) -> Any:
    """Recursively convert Neo4j/other non-JSON-safe values (DateTime etc.)."""
    if isinstance(obj, dict):
        return {k: _jsonify(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_jsonify(v) for v in obj]
    if isinstance(obj, (str, int, float, bool)) or obj is None:
        return obj
    try:
        json.dumps(obj)
        return obj
    except (TypeError, ValueError):
        return str(obj)


def _extract_name(text: str) -> Optional[str]:
    """Pull a likely person name out of a query by matching known persons."""
    known = neo.run_query("MATCH (p:Person) RETURN p.name AS name LIMIT 5000")
    for row in known:
        name = row.get("name")
        if name and name.lower() in text.lower():
            return name
    # Fallback: match a Capitalised word pair after "of"/"for"/"is".
    m = re.search(r"\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b", text)
    return m.group(1) if m else None


def _find_person(name: str) -> Optional[dict[str, Any]]:
    rows = neo.run_query(
        "MATCH (p:Person) WHERE toLower(p.name) = toLower($name) RETURN properties(p) AS props",
        {"name": name},
    )
    return rows[0]["props"] if rows else None


def _top_associates(name: str) -> tuple[str, list[dict[str, Any]], list[str]]:
    """Return a person's top associates with connection context."""
    person = _find_person(name)
    if not person:
        return f"I couldn't find a person named '{name}' in the network.", [], ["View in Network Map"]
    rows = neo.run_query(
        """
        MATCH (p:Person {id: $pid})-[r]-(m:Person)
        WITH m, count(r) AS links, collect(type(r)) AS types
        RETURN m.id AS id, m.name AS name, m.risk_score AS risk_score,
               links, types
        ORDER BY m.risk_score DESC LIMIT 5
        """,
        {"pid": person["id"]},
    )
    if not rows:
        return f"{name} has no known associates in the network.", [], ["View in Network Map"]
    associates = [
        {
            "id": r["id"], "name": r["name"], "risk_score": r["risk_score"],
            "links": r["links"], "types": r["types"][:3],
        }
        for r in rows
    ]
    text = f"Based on network analysis, {name}'s top associates are:\n" + "\n".join(
        f"{i+1}. {a['name']} — risk {a['risk_score']}/100 ({a['links']} links)"
        for i, a in enumerate(associates)
    )
    return text, associates, ["View in Network Map", "Generate Report"]


def _top_risks() -> tuple[str, list[dict[str, Any]], list[str]]:
    """Return the top 5 highest-risk criminals."""
    rows = neo.run_query(
        "MATCH (p:Person) WHERE p.risk_score IS NOT NULL RETURN properties(p) AS props "
        "ORDER BY p.risk_score DESC LIMIT 5"
    )
    items = [_jsonify(r["props"]) for r in rows]
    text = "Top 5 highest-risk individuals:\n" + "\n".join(
        f"{i+1}. {p.get('name')} — {p.get('risk_score')}/100 ({', '.join(p.get('crime_types') or []) or 'unknown'})"
        for i, p in enumerate(items)
    )
    return text, items, ["View in Network Map"]


def _connect(from_name: str, to_name: str) -> tuple[str, list[dict[str, Any]], list[str]]:
    """Find a path between two persons."""
    a = _find_person(from_name)
    b = _find_person(to_name)
    if not a or not b:
        return "One or both persons were not found.", [], []
    from app.services.graph_service import find_path

    path = find_path(a["id"], b["id"])
    if not path.get("found"):
        return f"No connection path found between {from_name} and {to_name} (within 6 hops).", [], []
    names = [n.get("name") for n in path["nodes"]]
    return (
        f"Path found: {' → '.join(names)} ({path['hops']} hops).",
        {"nodes": path["nodes"], "edges": path["edges"]},
        ["View in Network Map"],
    )


def _suspicious_transactions() -> tuple[str, list[dict[str, Any]], list[str]]:
    """List flagged accounts with suspicious amounts."""
    rows = neo.run_query(
        """
        MATCH (a:Account) WHERE a.flagged = true
        RETURN properties(a) AS props ORDER BY a.total_suspicious_amount DESC LIMIT 5
        """
    )
    items = [_jsonify(r["props"]) for r in rows]
    if not items:
        return "No flagged accounts found.", [], []
    text = "Top flagged accounts:\n" + "\n".join(
        f"{i+1}. {a.get('bank_name', 'Bank')} {a.get('account_number')} — ₹{a.get('total_suspicious_amount', 0):,}"
        for i, a in enumerate(items)
    )
    return text, items, ["Open Accounts View"]


def _crime_hotspots() -> tuple[str, list[dict[str, Any]], list[str]]:
    """List the top crime hotspots."""
    rows = neo.run_query(
        "MATCH (l:Location) RETURN properties(l) AS props ORDER BY l.hotspot_score DESC LIMIT 5"
    )
    items = [_jsonify(r["props"]) for r in rows]
    text = "Top crime hotspots:\n" + "\n".join(
        f"{i+1}. {l.get('name')} — hotspot score {l.get('hotspot_score', 0)}"
        for i, l in enumerate(items)
    )
    return text, items, ["Open Crime Map"]


def _gangs() -> tuple[str, list[dict[str, Any]], list[str]]:
    """Summarise detected communities/gangs."""
    from app.services.graph_service import get_communities

    communities = get_communities()
    items = communities[:5]
    text = "Detected criminal networks:\n" + "\n".join(
        f"{i+1}. {c['name']} — {c['size']} members"
        + (f" ({', '.join(c['crime_types'])})" if c.get("crime_types") else "")
        for i, c in enumerate(items)
    )
    return text, items, ["Open Community View"]


def _profile(name: str) -> tuple[str, list[dict[str, Any]], list[str]]:
    """Return a person's profile summary."""
    person = _find_person(name)
    if not person:
        return f"No profile found for '{name}'.", [], []
    person = _jsonify(person)
    risk = risk_service.score_criminal(person["id"])
    text = (
        f"Profile: {person.get('name')} ({person.get('criminal_id')})\n"
        f"Age: {person.get('age')} | Status: {person.get('status')}\n"
        f"Risk: {risk['score']}/100 ({risk['level']})\n"
        f"Crimes: {', '.join(person.get('crime_types') or []) or 'None recorded'}"
    )
    return text, person, ["View Full Profile", "Generate Report"]


# Intent routing table: (regex, handler_name) — most specific first so generic
# patterns (e.g. "top 5") cannot shadow concrete ones (e.g. "highest risk").
INTENTS = [
    (r"top risk|most dangerous|highest risk|most wanted|top \d+ risk", "top_risks"),
    (r"suspicious|transaction|money|financial|account", "transactions"),
    (r"crime in|hotspot|location|where", "hotspots"),
    (r"gang|community|network$", "gangs"),
    (r"associate|connection of|network of|who are|top \d+ associate", "associates"),
    (r"profile|who is", "profile"),
]


def _answer(message: str) -> dict[str, Any]:
    """Route a message to the appropriate intent handler."""
    text = message.strip()
    lower = text.lower()

    # Two-person connection question.
    connect_match = re.search(
        r"(?:connect|path between|link between)\s+(.+?)\s+(?:and|to|&)\s+(.+)", lower
    )
    if connect_match:
        reply, data, followups = _connect(
            _extract_name(connect_match.group(1)) or connect_match.group(1).title(),
            _extract_name(connect_match.group(2)) or connect_match.group(2).title(),
        )
        return {"response": reply, "data": data, "follow_ups": followups,
                "intent": "connect"}

    for pattern, intent in INTENTS:
        if re.search(pattern, lower):
            name = _extract_name(text)
            if intent == "associates" and name:
                reply, data, followups = _top_associates(name)
            elif intent == "profile" and name:
                reply, data, followups = _profile(name)
            elif intent == "top_risks":
                reply, data, followups = _top_risks()
            elif intent == "transactions":
                reply, data, followups = _suspicious_transactions()
            elif intent == "hotspots":
                reply, data, followups = _crime_hotspots()
            elif intent == "gangs":
                reply, data, followups = _gangs()
            else:
                continue
            return {"response": reply, "data": data, "follow_ups": followups,
                    "intent": intent}

    # Greetings: answer instantly instead of paying the local-LLM latency.
    if re.match(r"^\s*(hi|hii+|hello|hey|good\s+(morning|afternoon|evening))\b", lower):
        return {
            "response": (
                "Hello! I'm the CrimeNet assistant. Ask me about the network, e.g.:\n"
                "• \"Top 5 highest risk criminals\"\n"
                "• \"Who are Raja Khan's associates?\"\n"
                "• \"Connect Raja Khan and Vikram Rao\""
            ),
            "data": None,
            "follow_ups": ["Top 5 highest risk criminals", "Detected gangs",
                           "Suspicious transactions"],
            "intent": "greeting",
        }

    # Free-form question: try the local LLM before falling back to canned help.
    from app.services import llm_service

    llm_reply = llm_service.generate(text)
    if llm_reply:
        return {
            "response": llm_reply,
            "data": None,
            "follow_ups": ["Top 5 highest risk", "Detected gangs", "Suspicious transactions"],
            "intent": "llm",
        }

    return {
        "response": (
            "I can help you with:\n"
            "• \"Who are Raja Khan's associates?\"\n"
            "• \"Connect Raja Khan and Vikram Rao\"\n"
            "• \"Top 5 highest risk criminals\"\n"
            "• \"Show suspicious transactions\"\n"
            "• \"Crime hotspots\"\n"
            "• \"Detected gangs\"\n"
            "• \"Profile of Raja Khan\""
        ),
        "data": None,
        "follow_ups": ["Top 5 highest risk", "Detected gangs", "Suspicious transactions"],
        "intent": "help",
    }


@router.post("/message")
async def message(body: ChatMessage, user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    """Process a natural-language query and return a structured response."""
    # Off-loop: the LLM fallback and Neo4j queries are blocking CPU/IO work.
    result = await asyncio.to_thread(_answer, body.message)
    result["timestamp"] = datetime.now(timezone.utc).isoformat()
    # Persist conversation in Redis for history retrieval.
    session_id = body.session_id or str(user.get("sub"))
    history = cache_get(f"chat:history:{session_id}") or []
    history.append({"role": "user", "content": body.message,
                    "timestamp": result["timestamp"]})
    history.append({"role": "assistant", "content": result["response"],
                    "timestamp": result["timestamp"]})
    cache_set(f"chat:history:{session_id}", history[-40:], TTL["session"])
    return ok(result)


@router.get("/history/{session_id}")
async def history(session_id: str) -> dict[str, Any]:
    """Return a conversation history."""
    return ok(cache_get(f"chat:history:{session_id}") or [])
