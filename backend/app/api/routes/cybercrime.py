"""
Cyber-crime detection routes.

    POST /api/cybercrime/analyze             — analyse arbitrary evidence text
    POST /api/cybercrime/detect/{criminal_id} — detect cyber threats for a criminal
    GET  /api/cybercrime/risk/{criminal_id}   — cyber risk score only
    GET  /api/cybercrime/threats              — ranked cyber threats across the network
    POST /api/cybercrime/scan/url             — heuristic URL scan
    POST /api/cybercrime/scan/wallet          — heuristic crypto wallet scan
"""

from __future__ import annotations

import logging
import re
from typing import Any, Optional
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.api.middleware.auth_middleware import get_current_user
from app.api.routes import fail, ok
from app.database import neo4j_connection as neo
from app.ml_models.cyber_crime_detector import CATEGORIES, get_cyber_crime_detector
from app.services import risk_service

logger = logging.getLogger("crimenet.cybercrime")
router = APIRouter(dependencies=[Depends(get_current_user)])


# ── Request models ────────────────────────────────────────────────────────────
class AnalyzeRequest(BaseModel):
    """Evidence text or criminal attributes to analyse."""

    text: Optional[str] = Field(None, description="Evidence / FIR / message text")
    crime_types: list[str] = Field(default_factory=list)
    cyber_flags: list[str] = Field(default_factory=list)
    description: Optional[str] = None


class UrlScanRequest(BaseModel):
    url: str = Field(..., min_length=4)


class WalletScanRequest(BaseModel):
    address: str = Field(..., min_length=8)


# ── Helpers ───────────────────────────────────────────────────────────────────
def _evidence_from(body: AnalyzeRequest) -> dict[str, Any]:
    return {
        "text": body.text or "",
        "description": body.description or "",
        "crime_types": body.crime_types,
        "cyber_flags": body.cyber_flags,
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────
@router.post("/analyze")
async def analyze_evidence(body: AnalyzeRequest) -> dict[str, Any]:
    """Run the cyber-crime detector over arbitrary evidence text."""
    try:
        detector = get_cyber_crime_detector()
        result = detector.detect(_evidence_from(body))
        return ok(result, message="Cyber-crime analysis complete")
    except Exception as exc:  # noqa: BLE001
        logger.exception("Cyber analysis failed")
        return fail("Cyber analysis failed", error=str(exc))


@router.post("/detect/{criminal_id}")
async def detect_criminal(criminal_id: str) -> dict[str, Any]:
    """Assess a criminal's record for cyber-crime indicators."""
    try:
        person = risk_service.get_person(criminal_id)
        if not person:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Criminal not found")
        result = get_cyber_crime_detector().assess_criminal(person)
        return ok(result, message="Cyber threat assessment complete")
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        logger.exception("Cyber detection failed")
        return fail("Cyber detection failed", error=str(exc))


@router.get("/risk/{criminal_id}")
async def cyber_risk(criminal_id: str) -> dict[str, Any]:
    """Return only the cyber risk score/level for a criminal."""
    try:
        person = risk_service.get_person(criminal_id)
        if not person:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Criminal not found")
        detector = get_cyber_crime_detector()
        result = detector.detect({
            "text": str(person.get("description") or ""),
            "crime_types": person.get("crime_types") or [],
            "cyber_flags": person.get("cyber_flags") or [],
        })
        return ok({
            "criminal_id": criminal_id,
            "name": person.get("name"),
            "cyber_risk_score": result["cyber_risk_score"],
            "cyber_risk_level": result["cyber_risk_level"],
            "color": result["color"],
            "detected_threats": result["detected_threats"],
        })
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        logger.exception("Cyber risk scoring failed")
        return fail("Cyber risk scoring failed", error=str(exc))


@router.get("/threats")
async def cyber_threats(limit: int = 50) -> dict[str, Any]:
    """Ranked cyber threats across the network."""
    try:
        detector = get_cyber_crime_detector()
        # Pull persons whose recorded crime types touch cyber categories.
        cyber_tokens = ["cyber", "hack", "ransom", "phish", "crypto", "dark",
                        "online", "digital", "fraud", "tor", "malware", "launder"]
        rows = neo.run_query(
            """
            MATCH (p:Person)
            WHERE any(c IN coalesce(p.crime_types, []) WHERE
                  any(t IN $tokens WHERE toLower(c) CONTAINS t))
            RETURN properties(p) AS props
            LIMIT 500
            """,
            {"tokens": cyber_tokens},
        )
        threats: list[dict[str, Any]] = []
        for r in rows:
            person = r["props"]
            result = detector.assess_criminal(person)
            if result["cyber_risk_score"] >= 30 or result["detected_threats"]:
                threats.append({
                    "criminal_id": person.get("id"),
                    "name": person.get("name"),
                    "cyber_risk_score": result["cyber_risk_score"],
                    "cyber_risk_level": result["cyber_risk_level"],
                    "top_threats": [t["label"] for t in result["detected_threats"][:3]],
                })
        threats.sort(key=lambda t: -t["cyber_risk_score"])
        return ok({"threats": threats[:limit], "count": len(threats)})
    except Exception as exc:  # noqa: BLE001
        logger.exception("Cyber threat listing failed")
        return fail("Unable to list cyber threats", error=str(exc))


@router.post("/scan/url")
async def scan_url(body: UrlScanRequest) -> dict[str, Any]:
    """Heuristic scan of a URL for phishing / malicious indicators."""
    try:
        url = body.url.strip()
        parsed = urlparse(url if "://" in url else f"http://{url}")
        host = (parsed.hostname or "").lower()
        risk_flags: list[str] = []
        score = 0.0

        if parsed.scheme not in ("http", "https"):
            risk_flags.append("Non-HTTP(S) scheme")
            score += 25
        # IP-literal hosts are common in phishing.
        if re.match(r"^\d{1,3}(\.\d{1,3}){3}$", host):
            risk_flags.append("Raw IP address host")
            score += 30
        # Suspicious TLDs and free hosts.
        for tld in (".tk", ".ml", ".ga", ".cf", ".gq", ".xyz", ".top", ".club", ".online"):
            if host.endswith(tld):
                risk_flags.append(f"High-abuse TLD ({tld})")
                score += 15
                break
        for brand in ("paytm", "sbi", "hdfc", "icici", "amazon", "flipkart", "microsoft", "google", "apple", "irctc"):
            if brand in host and host != brand and not host.endswith(f"{brand}.com") and not host.endswith(f"{brand}.in"):
                risk_flags.append(f"Possible brand impersonation ({brand})")
                score += 20
                break
        # Long, entropy-heavy hosts are often generated.
        if len(host) > 40:
            risk_flags.append("Unusually long hostname")
            score += 10
        # Punycode lookalikes.
        if "xn--" in host:
            risk_flags.append("Punycode (IDN homograph) detected")
            score += 35

        level = ("CRITICAL" if score >= 70 else "HIGH" if score >= 45
                 else "MEDIUM" if score >= 20 else "LOW")
        return ok({
            "url": url,
            "host": host,
            "threat_score": round(min(100.0, score), 1),
            "threat_level": level,
            "flags": risk_flags,
            "verdict": "BLOCK" if score >= 45 else ("CAUTION" if score >= 20 else "ALLOW"),
        }, message="URL scan complete")
    except Exception as exc:  # noqa: BLE001
        logger.exception("URL scan failed")
        return fail("URL scan failed", error=str(exc))


@router.post("/scan/wallet")
async def scan_wallet(body: WalletScanRequest) -> dict[str, Any]:
    """Heuristic scan of a cryptocurrency wallet address."""
    try:
        address = body.address.strip()
        risk_flags: list[str] = []
        score = 0.0

        # BTC: base58 starting 1/3/bc1; ETH: 0x + 40 hex.
        is_eth = bool(re.fullmatch(r"0x[0-9a-fA-F]{40}", address))
        is_btc = bool(re.fullmatch(r"(1|3)[1-9A-HJ-NP-Za-km-z]{25,34}", address)) or \
            bool(re.fullmatch(r"bc1[0-9a-zA-Z]{25,62}", address))
        is_xmr = bool(re.fullmatch(r"4[0-9AB][1-9A-HJ-NP-Za-km-z]{93}", address))

        if not (is_eth or is_btc or is_xmr):
            risk_flags.append("Not a recognised BTC/ETH/XMR address")
            score += 40

        if is_xmr:
            risk_flags.append("Monero (privacy coin) — hard to trace")
            score += 20

        # Heuristic: newly seen address (no transaction history available locally).
        risk_flags.append("Address has no known attribution in local ledger")
        score += 10

        # Known tainted-pattern detection: addresses appearing in local evidence.
        from app.database.postgres_connection import fetch_one

        row = fetch_one(
            "SELECT 1 FROM evidence WHERE chain_of_custody LIKE %s LIMIT 1",
            (f"%{address}%",),
        )
        if row:
            risk_flags.append("Address linked to case evidence")
            score += 30

        level = ("CRITICAL" if score >= 70 else "HIGH" if score >= 45
                 else "MEDIUM" if score >= 20 else "LOW")
        return ok({
            "address": address,
            "currency": "XMR" if is_xmr else "ETH" if is_eth else "BTC" if is_btc else "UNKNOWN",
            "threat_score": round(min(100.0, score), 1),
            "threat_level": level,
            "flags": risk_flags,
            "verdict": "FLAG" if score >= 45 else ("MONITOR" if score >= 20 else "CLEAR"),
        }, message="Wallet scan complete")
    except Exception as exc:  # noqa: BLE001
        logger.exception("Wallet scan failed")
        return fail("Wallet scan failed", error=str(exc))
