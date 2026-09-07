"""
Blockchain & evidence-integrity routes.

Evidence on-chain, immutable audit trail, criminal record history, report
certificates and inter-agency sharing. Every endpoint degrades gracefully:
when Ganache/IPFS are unavailable the local ledger + local content store keep
the same contract working.

    GET  /api/blockchain/status                       — node + ledger status
    POST /api/blockchain/evidence/{criminal_id}       — upload evidence (IPFS + chain)
    POST /api/blockchain/evidence/verify              — verify a file against the chain
    GET  /api/blockchain/evidence/case/{case_number}  — case evidence
    GET  /api/blockchain/evidence/criminal/{id}       — criminal evidence
    POST /api/blockchain/evidence/{id}/court-admissible
    GET  /api/blockchain/audit/trail/{target_id}
    GET  /api/blockchain/audit/officer/{badge}
    GET  /api/blockchain/audit/suspicious
    POST /api/blockchain/records/{criminal_id}        — create/update on-chain record
    GET  /api/blockchain/records/{criminal_id}/history
    POST /api/blockchain/records/{criminal_id}/verify — integrity check
    POST /api/blockchain/reports/register             — register report certificate
    POST /api/blockchain/reports/verify               — verify report authenticity
    GET  /api/blockchain/reports/{report_id}/certificate
    POST /api/blockchain/share/grant                  — grant agency access
    POST /api/blockchain/share/verify                 — check access
    POST /api/blockchain/share/revoke                 — revoke access
    GET  /api/blockchain/share/data/{data_id}
    GET  /api/blockchain/share/agency/{agency}
    GET  /api/blockchain/transactions                 — recent ledger transactions
"""

from __future__ import annotations

import logging
import uuid
from typing import Any, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel, Field

from app.api.middleware.auth_middleware import get_current_user
from app.api.routes import fail, ok
from app.blockchain.agency_share_chain import ACCESS_LEVELS, AGENCIES, AgencyShareChain
from app.blockchain.audit_chain import AuditChain
from app.blockchain.evidence_chain import EvidenceChain
from app.blockchain.record_chain import RecordChain
from app.blockchain.report_chain import ReportChain
from app.blockchain.web3_connector import get_web3_connector

logger = logging.getLogger("crimenet.blockchain_routes")
router = APIRouter(dependencies=[Depends(get_current_user)])


# ── Request models ────────────────────────────────────────────────────────────
class RecordRequest(BaseModel):
    """Create or update a criminal record on-chain."""

    data: dict[str, Any] = Field(..., description="Full criminal record data")
    update_type: Optional[str] = Field(None, description="UPDATE type if this is a change")
    previous_data: Optional[dict[str, Any]] = None
    reason: Optional[str] = Field(None, description="Reason for the update")


class ReportRegisterRequest(BaseModel):
    """Register a report fingerprint on-chain."""

    report_type: str = Field(..., min_length=2)
    entity_id: str = Field(..., min_length=1)
    classification: str = Field("CONFIDENTIAL")
    content: Optional[str] = Field(None, description="Report text/JSON to hash")
    report_hash: Optional[str] = Field(None, description="Pre-computed SHA-256 (overrides content)")
    report_id: Optional[str] = None


class ReportVerifyRequest(BaseModel):
    """Verify a report against its on-chain certificate."""

    report_id: str
    content: Optional[str] = None
    report_hash: Optional[str] = None


class ShareGrantRequest(BaseModel):
    """Grant time-boxed access to another agency."""

    data_id: str = Field(..., min_length=1)
    data_type: str = Field("EVIDENCE")
    to_agency: str = Field(..., description="One of: " + ", ".join(AGENCIES))
    from_agency: Optional[str] = None
    access_level: str = Field("READ_ONLY", description="One of: " + ", ".join(ACCESS_LEVELS))
    duration_hours: int = Field(24, ge=1, le=8760)
    purpose: str = Field("Investigation")
    data: dict[str, Any] = Field(default_factory=dict)


class ShareVerifyRequest(BaseModel):
    """Check an agency permission id."""

    permission_id: str


class ShareRevokeRequest(BaseModel):
    """Revoke an agency permission id."""

    permission_id: str
    reason: str = Field("Investigation concluded")


def _officer(user: dict[str, Any]) -> str:
    """Resolve the officer badge id from the JWT payload."""
    return str(user.get("badge_id") or user.get("sub") or "system")


# ── Status ────────────────────────────────────────────────────────────────────
@router.get("/status")
async def blockchain_status() -> dict[str, Any]:
    """Return the blockchain/ledger network status."""
    try:
        connector = get_web3_connector()
        network = connector.get_network_status()
        stats = connector.backend.stats()
        return ok({
            "network": network,
            "stats": stats,
            "mode": connector.mode,
            "note": ("Live Ethereum node detected — transactions are real and immutable."
                     if connector.mode == "web3"
                     else "No node detected — running on the built-in local ledger."),
        })
    except Exception as exc:  # noqa: BLE001
        logger.exception("Blockchain status failed")
        return fail("Blockchain status unavailable", error=str(exc))


# ── Evidence ──────────────────────────────────────────────────────────────────
@router.post("/evidence/{criminal_id}")
async def upload_evidence_on_chain(
    criminal_id: str,
    file: UploadFile = File(...),
    case_number: str = Form(...),
    evidence_type: str = Form("DIGITAL"),
    description: str = Form(""),
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Upload evidence: store on IPFS and register the hash on-chain."""
    try:
        content = await file.read()
        evidence_id = f"ev-{uuid.uuid4().hex}"
        ipfs = get_ipfs_service()
        ipfs_hash = await ipfs.upload_file(content, file.filename or "evidence.bin")
        result = await EvidenceChain().add_evidence_to_blockchain(
            evidence_id=evidence_id,
            file_bytes=content,
            ipfs_hash=ipfs_hash,
            criminal_id=criminal_id,
            case_number=case_number,
            evidence_type=evidence_type,
            description=description,
            officer_badge_id=_officer(user),
        )
        result["file_name"] = file.filename
        result["file_size"] = len(content)
        return ok(result, message="Evidence secured on blockchain")
    except Exception as exc:  # noqa: BLE001
        logger.exception("Evidence upload failed")
        return fail("Evidence upload failed", error=str(exc))


@router.post("/evidence/verify")
async def verify_evidence_on_chain(
    evidence_id: str = Form(...),
    file: UploadFile = File(...),
) -> dict[str, Any]:
    """Verify that a file matches the immutable on-chain fingerprint."""
    try:
        content = await file.read()
        result = await EvidenceChain().verify_evidence(evidence_id, content)
        return ok(result, message="Evidence verification complete")
    except Exception as exc:  # noqa: BLE001
        logger.exception("Evidence verification failed")
        return fail("Evidence verification failed", error=str(exc))


@router.get("/evidence/case/{case_number}")
async def case_evidence(case_number: str) -> dict[str, Any]:
    """List on-chain evidence records for a case."""
    try:
        records = await EvidenceChain().get_evidence_for_case(case_number)
        return ok({"case_number": case_number, "evidence": records})
    except Exception as exc:  # noqa: BLE001
        logger.exception("Case evidence listing failed")
        return fail("Unable to list case evidence", error=str(exc))


@router.get("/evidence/criminal/{criminal_id}")
async def criminal_evidence(criminal_id: str) -> dict[str, Any]:
    """List on-chain evidence records for a criminal."""
    try:
        records = await EvidenceChain().get_evidence_for_criminal(criminal_id)
        return ok({"criminal_id": criminal_id, "evidence": records})
    except Exception as exc:  # noqa: BLE001
        logger.exception("Criminal evidence listing failed")
        return fail("Unable to list criminal evidence", error=str(exc))


@router.post("/evidence/{evidence_id}/court-admissible")
async def mark_court_admissible(
    evidence_id: str,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Mark evidence as court-admissible (senior officers only)."""
    try:
        role = user.get("role", "OFFICER")
        if role not in ("SENIOR_OFFICER", "ADMIN"):
            raise HTTPException(status.HTTP_403_FORBIDDEN,
                                detail="Only senior officers may mark evidence court-admissible")
        result = await EvidenceChain().mark_court_admissible(evidence_id, _officer(user))
        return ok(result, message="Evidence marked court-admissible")
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        logger.exception("Court-admissible marking failed")
        return fail("Unable to mark evidence", error=str(exc))


# ── Audit trail ───────────────────────────────────────────────────────────────
@router.get("/audit/trail/{target_id}")
async def audit_trail(target_id: str) -> dict[str, Any]:
    """Immutable audit history for a target."""
    try:
        records = await AuditChain().get_audit_trail(target_id)
        return ok({"target_id": target_id, "records": records, "count": len(records)})
    except Exception as exc:  # noqa: BLE001
        logger.exception("Audit trail failed")
        return fail("Unable to fetch audit trail", error=str(exc))


@router.get("/audit/officer/{officer_badge}")
async def officer_activity(officer_badge: str) -> dict[str, Any]:
    """All actions recorded for an officer."""
    try:
        records = await AuditChain().get_officer_activity(officer_badge)
        return ok({"officer_badge": officer_badge, "records": records, "count": len(records)})
    except Exception as exc:  # noqa: BLE001
        logger.exception("Officer activity failed")
        return fail("Unable to fetch officer activity", error=str(exc))


@router.get("/audit/suspicious")
async def suspicious_activity() -> dict[str, Any]:
    """Recent suspicious-activity signals from the ledger."""
    try:
        records = await AuditChain().get_suspicious_activity()
        return ok({"records": records, "count": len(records)})
    except Exception as exc:  # noqa: BLE001
        logger.exception("Suspicious activity listing failed")
        return fail("Unable to fetch suspicious activity", error=str(exc))


# ── Criminal records ──────────────────────────────────────────────────────────
@router.post("/records/{criminal_id}")
async def update_record_on_chain(
    criminal_id: str,
    body: RecordRequest,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Create or append to the immutable on-chain record history."""
    try:
        chain = RecordChain()
        if body.update_type:
            result = await chain.update_criminal_on_chain(
                criminal_id=criminal_id,
                update_type=body.update_type,
                previous_data=body.previous_data or {},
                new_data=body.data,
                reason=body.reason or "Manual update",
                officer_badge=_officer(user),
            )
            message = "Record update committed to blockchain"
        else:
            result = await chain.create_criminal_on_chain(criminal_id, body.data)
            message = "Criminal record created on blockchain"
        return ok(result, message=message)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Record update failed")
        return fail("Record update failed", error=str(exc))


@router.get("/records/{criminal_id}/history")
async def record_history(criminal_id: str) -> dict[str, Any]:
    """Complete append-only change history for a criminal record."""
    try:
        history = await RecordChain().get_complete_change_history(criminal_id)
        return ok({"criminal_id": criminal_id, "history": history, "count": len(history)})
    except Exception as exc:  # noqa: BLE001
        logger.exception("Record history failed")
        return fail("Unable to fetch record history", error=str(exc))


@router.post("/records/{criminal_id}/verify")
async def verify_record_integrity(
    criminal_id: str,
    body: RecordRequest,
) -> dict[str, Any]:
    """Verify the current database record against the on-chain hash."""
    try:
        result = await RecordChain().verify_criminal_data_integrity(criminal_id, body.data)
        return ok(result, message="Record integrity verified")
    except Exception as exc:  # noqa: BLE001
        logger.exception("Record integrity verification failed")
        return fail("Record integrity verification failed", error=str(exc))


# ── Reports ───────────────────────────────────────────────────────────────────
@router.post("/reports/register")
async def register_report(
    body: ReportRegisterRequest,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Register a report fingerprint on-chain and return its certificate."""
    try:
        if body.report_hash:
            report_bytes = bytes.fromhex(body.report_hash.replace("0x", "") or "00")
            if not body.content:
                body.content = body.report_hash  # hash-only registration
        content = (body.content or "").encode("utf-8")
        if not body.report_hash:
            report_bytes = content
        report_id = body.report_id or f"rep-{uuid.uuid4().hex}"
        result = await ReportChain().register_report(
            report_id=report_id,
            report_type=body.report_type,
            entity_id=body.entity_id,
            report_bytes=report_bytes,
            classification=body.classification,
            officer_badge=_officer(user),
        )
        return ok(result, message="Report certificate registered on blockchain")
    except Exception as exc:  # noqa: BLE001
        logger.exception("Report registration failed")
        return fail("Report registration failed", error=str(exc))


@router.post("/reports/verify")
async def verify_report(body: ReportVerifyRequest) -> dict[str, Any]:
    """Verify a report against its on-chain certificate."""
    try:
        if body.report_hash:
            report_bytes = bytes.fromhex(body.report_hash.replace("0x", "") or "00")
        else:
            report_bytes = (body.content or "").encode("utf-8")
        result = await ReportChain().verify_report_authenticity(body.report_id, report_bytes)
        return ok(result, message="Report authenticity verified")
    except Exception as exc:  # noqa: BLE001
        logger.exception("Report verification failed")
        return fail("Report verification failed", error=str(exc))


@router.get("/reports/{report_id}/certificate")
async def report_certificate(report_id: str) -> dict[str, Any]:
    """Return the on-chain certificate metadata for a report."""
    try:
        certificate = await ReportChain().get_report_certificate(report_id)
        if not certificate:
            return fail("Report certificate not found", error="NOT_FOUND")
        return ok(certificate)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Certificate fetch failed")
        return fail("Unable to fetch certificate", error=str(exc))


# ── Agency sharing ────────────────────────────────────────────────────────────
@router.post("/share/grant")
async def grant_share(
    body: ShareGrantRequest,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Grant time-boxed, level-scoped access to another agency."""
    try:
        if body.to_agency.upper() not in AGENCIES:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Unknown agency")
        if body.access_level.upper() not in ACCESS_LEVELS:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Unknown access level")
        chain = AgencyShareChain()
        result = await chain.grant_agency_access(
            data_id=body.data_id,
            data_type=body.data_type,
            from_agency=body.from_agency or str(user.get("department") or "STATE_POLICE"),
            to_agency=body.to_agency.upper(),
            access_level=body.access_level.upper(),
            duration_hours=body.duration_hours,
            current_data=body.data,
            purpose=body.purpose,
            officer_badge=_officer(user),
        )
        return ok(result, message="Agency access granted")
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        logger.exception("Share grant failed")
        return fail("Unable to grant access", error=str(exc))


@router.post("/share/verify")
async def verify_share(body: ShareVerifyRequest) -> dict[str, Any]:
    """Check whether a permission id currently grants access."""
    try:
        result = await AgencyShareChain().verify_agency_access(body.permission_id)
        return ok(result, message="Access checked")
    except Exception as exc:  # noqa: BLE001
        logger.exception("Share verification failed")
        return fail("Unable to verify access", error=str(exc))


@router.post("/share/revoke")
async def revoke_share(
    body: ShareRevokeRequest,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Revoke a permission on-chain."""
    try:
        result = await AgencyShareChain().revoke_access(body.permission_id, body.reason)
        return ok(result, message="Access revoked")
    except Exception as exc:  # noqa: BLE001
        logger.exception("Share revocation failed")
        return fail("Unable to revoke access", error=str(exc))


@router.get("/share/data/{data_id}")
async def data_permissions(data_id: str) -> dict[str, Any]:
    """All active permissions for a data id."""
    try:
        records = await AgencyShareChain().get_active_permissions(data_id)
        return ok({"data_id": data_id, "permissions": records})
    except Exception as exc:  # noqa: BLE001
        logger.exception("Data permissions listing failed")
        return fail("Unable to list permissions", error=str(exc))


@router.get("/share/agency/{agency}")
async def agency_permissions(agency: str) -> dict[str, Any]:
    """All permissions held by an agency."""
    try:
        records = await AgencyShareChain().get_all_agency_permissions(agency.upper())
        return ok({"agency": agency.upper(), "permissions": records})
    except Exception as exc:  # noqa: BLE001
        logger.exception("Agency permissions listing failed")
        return fail("Unable to list agency permissions", error=str(exc))


# ── Ledger transactions ───────────────────────────────────────────────────────
@router.get("/transactions")
async def recent_transactions() -> dict[str, Any]:
    """Recent on-chain transactions (local ledger only)."""
    try:
        connector = get_web3_connector()
        txs = connector.backend.recent_transactions(50)
        return ok({"transactions": txs})
    except Exception as exc:  # noqa: BLE001
        logger.exception("Transaction listing failed")
        return fail("Unable to list transactions", error=str(exc))


# ── Tamper Detection Live Demo ────────────────────────────────────────────────
# Self-contained flow: store text → get hash → verify original → tamper → detect
import hashlib as _hashlib
from datetime import datetime as _datetime, timezone as _tz

_tamper_store: dict[str, dict[str, Any]] = {}   # in-memory for demo speed


class TamperStoreRequest(BaseModel):
    """Store evidence text on-chain for the tamper demo."""
    evidence_text: str = Field(..., min_length=1)
    case_label: str = Field("DEMO-001")


class TamperVerifyRequest(BaseModel):
    """Verify evidence text against stored hash."""
    evidence_id: str = Field(...)
    evidence_text: str = Field(..., min_length=1)


@router.post("/tamper-demo/store")
async def tamper_demo_store(
    body: TamperStoreRequest,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Store evidence text and its SHA-256 hash for tamper detection demo."""
    try:
        evidence_id = f"demo-{uuid.uuid4().hex[:12]}"
        content_bytes = body.evidence_text.encode("utf-8")
        sha256 = _hashlib.sha256(content_bytes).hexdigest()
        timestamp = _datetime.now(_tz.utc).isoformat()

        # Store in local ledger for persistence + in-memory for speed
        connector = get_web3_connector()
        tx = connector.backend.evidence_add(
            evidence_id=evidence_id,
            file_hash=sha256,
            ipfs_hash=f"Qm{sha256[:44]}",
            criminal_id="tamper-demo",
            case_number=body.case_label,
            officer_badge_id="demo-officer",
            evidence_type="TEXT",
            description="Tamper detection demo evidence",
        )

        tx_hash = tx.get("transaction_hash", "0x" + sha256[:64])

        _tamper_store[evidence_id] = {
            "hash": sha256,
            "timestamp": timestamp,
            "case_label": body.case_label,
            "officer": _officer(user),
            "char_count": len(body.evidence_text),
            "tx_hash": tx_hash,
        }

        return ok({
            "evidence_id": evidence_id,
            "sha256": sha256,
            "timestamp": timestamp,
            "tx_hash": tx_hash,
            "block": tx.get("block_number", 0),
            "status": "SECURED",
        }, message="Evidence fingerprint secured on blockchain")
    except Exception as exc:  # noqa: BLE001
        logger.exception("Tamper demo store failed")
        return fail("Store failed", error=str(exc))


@router.post("/tamper-demo/verify")
async def tamper_demo_verify(body: TamperVerifyRequest) -> dict[str, Any]:
    """Verify evidence text against the stored blockchain hash."""
    try:
        stored = _tamper_store.get(body.evidence_id)
        if not stored:
            return ok({
                "verified": False,
                "integrity": "NOT_FOUND",
                "message": f"Evidence {body.evidence_id} not found in blockchain",
            })

        current_hash = _hashlib.sha256(body.evidence_text.encode("utf-8")).hexdigest()
        original_hash = stored["hash"]
        matched = current_hash == original_hash

        # Compute diff position for tampered evidence
        diff_info = None
        if not matched:
            orig_text = None  # we don't store original text, only hash
            diff_info = {
                "original_hash": original_hash,
                "current_hash": current_hash,
                "hash_mismatch": True,
                "bits_changed": bin(int(original_hash, 16) ^ int(current_hash, 16)).count("1"),
            }

        return ok({
            "verified": matched,
            "integrity": "INTACT" if matched else "TAMPERED",
            "message": (
                "✅ Evidence integrity VERIFIED — content matches blockchain fingerprint"
                if matched
                else "🚨 TAMPER DETECTED — content does NOT match the original blockchain fingerprint"
            ),
            "original_hash": original_hash,
            "current_hash": current_hash,
            "stored_at": stored["timestamp"],
            "tx_hash": stored["tx_hash"],
            "diff": diff_info,
        })
    except Exception as exc:  # noqa: BLE001
        logger.exception("Tamper demo verify failed")
        return fail("Verification failed", error=str(exc))


def get_ipfs_service():
    """Local import to avoid a module-level dependency on the IPFS client."""
    from app.services.ipfs_service import get_ipfs_service as _g

    return _g()
