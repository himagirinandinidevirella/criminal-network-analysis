"""
Web3 connector — the single gateway to the CrimeNet blockchain.

TWO MODES (selected automatically at startup):

  1. `web3`    — a live Ethereum node (Ganache) is reachable and the five
                 contracts are deployed; all writes are real on-chain
                 transactions with real hashes, blocks and receipts.
  2. `offline` — no node / no contracts; a deterministic **local ledger**
                 mirrors the contract storage model (append-only, content-
                 addressed) so evidence verification, audit trails, record
                 integrity and sharing keep working. The system NEVER breaks
                 because blockchain is unavailable — it is an enhancement.

The rest of the application talks to `connector.backend`, which exposes the
same method surface in both modes.
"""

from __future__ import annotations

import base64
import hashlib
import json
import logging
import os
import threading
import time
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger("crimenet.blockchain")

# ── Configuration ─────────────────────────────────────────────────────────────
_BACKEND_ROOT = Path(__file__).resolve().parents[2]  # .../backend
_PROJECT_ROOT = _BACKEND_ROOT.parent                # .../criminal-network-analysis
WEB3_PROVIDER_URI = os.getenv("WEB3_PROVIDER_URI", "http://localhost:8545")
CHAIN_ID = int(os.getenv("BLOCKCHAIN_CHAIN_ID", "1337"))
LEDGER_PATH = Path(os.getenv(
    "CRIMENET_LEDGER_PATH", str(_BACKEND_ROOT / "data" / "blockchain" / "ledger.json")
))

# Candidate locations for the deployment metadata produced by deploy.js.
_CONTRACTS_ENV = os.getenv("BLOCKCHAIN_CONTRACTS_PATH", "")
CONTRACT_JSON_PATHS = [
    Path(_BACKEND_ROOT / "app" / "blockchain" / "abis" / "deployed_contracts.json"),
    Path(_PROJECT_ROOT / "blockchain" / "deployed_contracts.json"),
    *([Path(_CONTRACTS_ENV)] if _CONTRACTS_ENV else []),
]


def _now() -> int:
    return int(time.time())


def _tx_hash(payload: dict[str, Any]) -> str:
    """Deterministic transaction hash for the local ledger."""
    canonical = json.dumps(payload, sort_keys=True, default=str).encode("utf-8")
    return "0x" + hashlib.sha256(canonical).hexdigest()


# ─────────────────────────────────────────────────────────────────────────────
# LOCAL LEDGER (offline fallback backend)
# Mirrors the smart-contract storage model with an append-only JSON store.
# ─────────────────────────────────────────────────────────────────────────────
class LocalLedger:
    """Deterministic, file-persisted mirror of the five contracts."""

    def __init__(self) -> None:
        LEDGER_PATH.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._state: dict[str, Any] = self._load()

    # ── Persistence ───────────────────────────────────────────────────────────
    def _load(self) -> dict[str, Any]:
        if LEDGER_PATH.exists():
            try:
                return json.loads(LEDGER_PATH.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError) as exc:
                logger.warning("Ledger corrupt (%s); starting fresh", exc)
        return self._empty_state()

    @staticmethod
    def _empty_state() -> dict[str, Any]:
        return {
            "block_number": 0,
            "evidence": {},
            "evidence_by_case": {},
            "evidence_by_criminal": {},
            "records": {},
            "record_history": {},
            "audit": [],
            "audit_by_target": {},
            "reports": {},
            "reports_by_entity": {},
            "shares": {},
            "shares_by_data": {},
            "transactions": [],
        }

    def _save(self) -> None:
        with self._lock:
            LEDGER_PATH.write_text(
                json.dumps(self._state, default=str, indent=2), encoding="utf-8"
            )

    def _commit(self, kind: str, action: str, meta: dict[str, Any] = None) -> dict[str, Any]:
        """Append a transaction and bump the block number."""
        self._state["block_number"] += 1
        block_number = self._state["block_number"]
        tx = {
            "kind": kind,
            "action": action,
            "timestamp": _now(),
            "block_number": block_number,
            "transaction_hash": _tx_hash({"kind": kind, "action": action, "block": block_number, **((meta or {}))}),
        }
        self._state["transactions"].insert(0, tx)
        self._state["transactions"] = self._state["transactions"][:200]
        self._save()
        return tx

    # ── Evidence ──────────────────────────────────────────────────────────────
    def evidence_add(self, evidence_id, file_hash, ipfs_hash, criminal_id,
                     case_number, officer_badge_id, evidence_type, description):
        if evidence_id in self._state["evidence"]:
            raise ValueError("Evidence already exists")
        record = {
            "evidenceId": evidence_id, "fileHash": file_hash, "ipfsHash": ipfs_hash,
            "criminalId": criminal_id, "caseNumber": case_number,
            "uploadedBy": self._officer_address(officer_badge_id),
            "officerBadgeId": officer_badge_id, "timestamp": _now(),
            "evidenceType": evidence_type, "description": description,
            "isValid": True, "courtAdmissible": False,
        }
        self._state["evidence"][evidence_id] = record
        self._state["evidence_by_case"].setdefault(case_number, []).append(evidence_id)
        self._state["evidence_by_criminal"].setdefault(criminal_id, []).append(evidence_id)
        return self._commit("evidence", "addEvidence", {"evidence_id": evidence_id})

    def evidence_verify(self, evidence_id, check_hash):
        record = self._state["evidence"].get(evidence_id)
        if not record:
            return {"verified": False, "message": "NOT FOUND - NO BLOCKCHAIN RECORD",
                    "original_timestamp": 0, "record": None}
        if not record["isValid"]:
            return {"verified": False, "message": "INVALIDATED - RECORD REVOKED",
                    "original_timestamp": record["timestamp"], "record": record}
        if record["fileHash"] == check_hash:
            return {"verified": True, "message": "VERIFIED - NOT TAMPERED",
                    "original_timestamp": record["timestamp"], "record": record}
        return {"verified": False, "message": "TAMPERED - HASH MISMATCH",
                "original_timestamp": record["timestamp"], "record": record}

    def evidence_get(self, evidence_id):
        return self._state["evidence"].get(evidence_id)

    def evidence_mark_court_admissible(self, evidence_id):
        record = self._state["evidence"].get(evidence_id)
        if not record:
            raise ValueError("Evidence not found")
        record["courtAdmissible"] = True
        self._save()
        return self._commit("evidence", "markCourtAdmissible", {"evidence_id": evidence_id})

    def evidence_list_by_case(self, case_number):
        ids = self._state["evidence_by_case"].get(case_number, [])
        return [self._state["evidence"][i] for i in ids if i in self._state["evidence"]]

    def evidence_list_by_criminal(self, criminal_id):
        ids = self._state["evidence_by_criminal"].get(criminal_id, [])
        return [self._state["evidence"][i] for i in ids if i in self._state["evidence"]]

    # ── Criminal records ──────────────────────────────────────────────────────
    def record_create(self, criminal_id, data_hash):
        if criminal_id in self._state["records"]:
            raise ValueError("Record already exists")
        self._state["records"][criminal_id] = {
            "criminalId": criminal_id, "currentDataHash": data_hash,
            "createdAt": _now(), "lastUpdated": _now(), "updateCount": 0,
            "isActive": True, "highRisk": False,
        }
        self._state["record_history"].setdefault(criminal_id, [])
        return self._commit("record", "createRecord", {"criminal_id": criminal_id})

    def record_update(self, criminal_id, update_type, previous_value, new_value,
                      reason, new_hash, officer_badge_id):
        if criminal_id not in self._state["records"]:
            raise ValueError("Record not found")
        entry = {
            "updateId": len(self._state["record_history"][criminal_id]) + 1,
            "criminalId": criminal_id, "updateType": update_type,
            "previousValue": previous_value, "newValue": new_value,
            "updatedBy": self._officer_address(officer_badge_id),
            "officerBadgeId": officer_badge_id, "timestamp": _now(),
            "reason": reason, "dataHash": new_hash, "isVerified": True,
        }
        self._state["record_history"][criminal_id].append(entry)
        rec = self._state["records"][criminal_id]
        rec["currentDataHash"] = new_hash
        rec["lastUpdated"] = _now()
        rec["updateCount"] += 1
        return self._commit("record", "updateRecord", {"criminal_id": criminal_id})

    def record_history(self, criminal_id):
        return self._state["record_history"].get(criminal_id, [])

    def record_latest_hash(self, criminal_id):
        rec = self._state["records"].get(criminal_id)
        return rec["currentDataHash"] if rec else None

    def record_verify(self, criminal_id, check_hash):
        rec = self._state["records"].get(criminal_id)
        if not rec:
            return False
        return bool(rec["isActive"] and rec["currentDataHash"] == check_hash)

    def record_mark_high_risk(self, criminal_id):
        if criminal_id not in self._state["records"]:
            raise ValueError("Record not found")
        self._state["records"][criminal_id]["highRisk"] = True
        self._save()
        return self._commit("record", "markHighRisk", {"criminal_id": criminal_id})

    # ── Audit ─────────────────────────────────────────────────────────────────
    def audit_log(self, officer_badge_id, department, action, target_id,
                  target_type, ip_hash, result, data_hash, session_hash, officer_address=None):
        entry = {
            "logId": len(self._state["audit"]),
            "officerAddress": officer_address or self._officer_address(officer_badge_id),
            "officerBadgeId": officer_badge_id, "officerDepartment": department,
            "action": action, "targetId": target_id, "targetType": target_type,
            "timestamp": _now(), "ipAddress": ip_hash, "result": result,
            "dataHash": data_hash, "sessionHash": session_hash,
        }
        self._state["audit"].append(entry)
        self._state["audit_by_target"].setdefault(target_id, []).append(entry["logId"])
        return self._commit("audit", "logAction", {"target_id": target_id})

    def audit_by_target(self, target_id):
        ids = self._state["audit_by_target"].get(target_id, [])
        return [self._state["audit"][i] for i in ids if i < len(self._state["audit"])]

    def audit_by_officer(self, officer_key):
        return [e for e in self._state["audit"]
                if e.get("officerBadgeId") == officer_key or e.get("officerAddress") == officer_key]

    def audit_total(self):
        return len(self._state["audit"])

    # ── Reports ───────────────────────────────────────────────────────────────
    def report_register(self, report_id, report_type, entity_id, report_hash,
                        classification, signature, officer_badge_id):
        if report_id in self._state["reports"]:
            raise ValueError("Report already registered")
        self._state["reports"][report_id] = {
            "reportId": report_id, "reportType": report_type, "entityId": entity_id,
            "reportHash": report_hash, "generatedBy": self._officer_address(officer_badge_id),
            "officerBadgeId": officer_badge_id, "generatedAt": _now(),
            "classification": classification, "isRevoked": False,
            "revokedReason": "", "version": 1, "digitalSignature": signature,
        }
        self._state["reports_by_entity"].setdefault(entity_id, []).append(report_id)
        return self._commit("report", "registerReport", {"report_id": report_id})

    def report_verify(self, report_id, check_hash):
        rep = self._state["reports"].get(report_id)
        if not rep:
            return False
        return bool((not rep["isRevoked"]) and rep["reportHash"] == check_hash)

    def report_get(self, report_id):
        return self._state["reports"].get(report_id)

    def report_list_by_entity(self, entity_id):
        ids = self._state["reports_by_entity"].get(entity_id, [])
        return [self._state["reports"][i] for i in ids if i in self._state["reports"]]

    # ── Agency sharing ────────────────────────────────────────────────────────
    def share_grant(self, data_id, data_type, to_agency, from_agency, access_level,
                    duration_hours, data_hash, purpose, officer_badge_id):
        permission_id = "0x" + hashlib.sha256(
            f"{data_id}:{to_agency}:{from_agency}:{_now()}".encode()
        ).hexdigest()
        self._state["shares"][permission_id] = {
            "permissionId": permission_id, "dataId": data_id, "dataType": data_type,
            "fromAgency": from_agency, "toAgency": to_agency, "accessLevel": access_level,
            "grantedAt": _now(), "expiresAt": _now() + duration_hours * 3600,
            "isActive": True, "dataHash": data_hash,
            "grantedBy": self._officer_address(officer_badge_id),
            "purpose": purpose, "accessCount": 0,
        }
        self._state["shares_by_data"].setdefault(data_id, []).append(permission_id)
        self._commit("share", "grantAccess", {"data_id": data_id})
        return permission_id

    def share_check(self, permission_id):
        p = self._state["shares"].get(permission_id)
        if not p:
            return {"hasAccess": False, "level": "READ_ONLY"}
        if not p["isActive"] or _now() > p["expiresAt"]:
            return {"hasAccess": False, "level": p["accessLevel"]}
        return {"hasAccess": True, "level": p["accessLevel"]}

    def share_revoke(self, permission_id, reason):
        p = self._state["shares"].get(permission_id)
        if not p:
            raise ValueError("Permission not found")
        p["isActive"] = False
        p["revokeReason"] = reason
        self._save()
        return self._commit("share", "revokeAccess", {"permission_id": permission_id})

    def share_log_access(self, permission_id):
        p = self._state["shares"].get(permission_id)
        if not p:
            raise ValueError("Permission not found")
        p["accessCount"] += 1
        self._save()
        return self._commit("share", "logAccess", {"permission_id": permission_id})

    def share_list_by_data(self, data_id):
        ids = self._state["shares_by_data"].get(data_id, [])
        return [self._state["shares"][i] for i in ids if i in self._state["shares"]]

    def share_list_by_agency(self, agency):
        return [p for p in self._state["shares"].values() if p["toAgency"] == agency]

    # ── Meta ──────────────────────────────────────────────────────────────────
    def recent_transactions(self, n=20):
        return self._state["transactions"][:n]

    def stats(self):
        return {
            "total_evidence": len(self._state["evidence"]),
            "total_audit": len(self._state["audit"]),
            "total_records": len(self._state["records"]),
            "total_reports": len(self._state["reports"]),
            "total_shares": len(self._state["shares"]),
            "block_number": self._state["block_number"],
        }

    @staticmethod
    def _officer_address(badge_id: str) -> str:
        return "0x" + hashlib.sha256(f"officer:{badge_id}".encode()).hexdigest()[:40]


# ─────────────────────────────────────────────────────────────────────────────
# WEB3 BACKEND (real on-chain transactions)
# ─────────────────────────────────────────────────────────────────────────────
class Web3Backend:
    """Delegates to the deployed contracts via Web3.py."""

    def __init__(self, connector: "Web3Connector") -> None:
        self.connector = connector
        self.w3 = connector.w3

    def _call(self, contract_key: str, fn_name: str, *args: Any) -> Any:
        contract = self.connector.get_contract(contract_key)
        return getattr(contract.functions, fn_name)(*args).call()

    def _send(self, contract_key: str, fn_name: str, *args: Any) -> dict[str, Any]:
        contract = self.connector.get_contract(contract_key)
        account = self.connector.default_account
        fn = getattr(contract.functions, fn_name)(*args)
        tx = fn.transact({"from": account, "gas": 3_000_000})
        receipt = self.w3.eth.wait_for_transaction_receipt(tx)
        return {
            "transaction_hash": tx.hex(),
            "block_number": receipt.get("blockNumber"),
            "timestamp": _now(),
            "gas_used": receipt.get("gasUsed"),
        }

    # Evidence
    def evidence_add(self, evidence_id, file_hash, ipfs_hash, criminal_id, case_number,
                     officer_badge_id, evidence_type, description):
        return self._send("evidence", "addEvidence", evidence_id,
                          self._b32(file_hash), ipfs_hash, criminal_id, case_number,
                          officer_badge_id, evidence_type, description)

    def evidence_verify(self, evidence_id, check_hash):
        verified, message, ts = self._call("evidence", "verifyEvidence",
                                           evidence_id, self._b32(check_hash))
        record = self.connector._struct_to_dict(
            self.connector._abi_outputs("evidence", "getEvidence"),
            self._call("evidence", "getEvidence", evidence_id))
        return {"verified": verified, "message": message, "original_timestamp": ts, "record": record}

    def evidence_get(self, evidence_id):
        return self.connector._struct_to_dict(
            self.connector._abi_outputs("evidence", "getEvidence"),
            self._call("evidence", "getEvidence", evidence_id))

    def evidence_mark_court_admissible(self, evidence_id):
        return self._send("evidence", "markCourtAdmissible", evidence_id)

    def evidence_list_by_case(self, case_number):
        comps = self.connector._abi_outputs("evidence", "getEvidencesByCase")
        return [self.connector._struct_to_dict(comps[0]["components"], e)
                for e in self._call("evidence", "getEvidencesByCase", case_number)]

    def evidence_list_by_criminal(self, criminal_id):
        comps = self.connector._abi_outputs("evidence", "getEvidencesByCriminal")
        return [self.connector._struct_to_dict(comps[0]["components"], e)
                for e in self._call("evidence", "getEvidencesByCriminal", criminal_id)]

    # Records
    def record_create(self, criminal_id, data_hash):
        return self._send("criminal_record", "createRecord", criminal_id, self._b32(data_hash))

    def record_update(self, criminal_id, update_type, previous_value, new_value,
                      reason, new_hash, officer_badge_id):
        return self._send("criminal_record", "updateRecord", criminal_id, update_type,
                          previous_value, new_value, reason, self._b32(new_hash))

    def record_history(self, criminal_id):
        comps = self.connector._abi_outputs("criminal_record", "getFullHistory")
        return [self.connector._struct_to_dict(comps[0]["components"], e)
                for e in self._call("criminal_record", "getFullHistory", criminal_id)]

    def record_latest_hash(self, criminal_id):
        raw = self._call("criminal_record", "getLatestHash", criminal_id)
        return "0x" + raw.hex() if raw else None

    def record_verify(self, criminal_id, check_hash):
        return self._call("criminal_record", "verifyCurrentData", criminal_id, self._b32(check_hash))

    def record_mark_high_risk(self, criminal_id):
        return self._send("criminal_record", "markHighRisk", criminal_id)

    # Audit
    def audit_log(self, officer_badge_id, department, action, target_id, target_type,
                  ip_hash, result, data_hash, session_hash, officer_address=None):
        return self._send("audit", "logAction", officer_badge_id, department, action,
                          target_id, target_type, ip_hash, result, self._b32(data_hash),
                          self._b32(session_hash))

    def audit_by_target(self, target_id):
        comps = self.connector._abi_outputs("audit", "getAuditByTarget")
        return [self.connector._struct_to_dict(comps[0]["components"], e)
                for e in self._call("audit", "getAuditByTarget", target_id)]

    def audit_by_officer(self, officer_address):
        comps = self.connector._abi_outputs("audit", "getAuditByOfficer")
        return [self.connector._struct_to_dict(comps[0]["components"], e)
                for e in self._call("audit", "getAuditByOfficer", officer_address)]

    def audit_total(self):
        return self._call("audit", "getTotalLogsCount")

    # Reports
    def report_register(self, report_id, report_type, entity_id, report_hash,
                        classification, signature, officer_badge_id):
        return self._send("report", "registerReport", report_id, report_type, entity_id,
                          self._b32(report_hash), classification, self._sig_bytes(signature))

    def report_verify(self, report_id, check_hash):
        return self._call("report", "verifyReport", report_id, self._b32(check_hash))

    def report_get(self, report_id):
        return self.connector._struct_to_dict(
            self.connector._abi_outputs("report", "getReport"),
            self._call("report", "getReport", report_id))

    def report_list_by_entity(self, entity_id):
        comps = self.connector._abi_outputs("report", "getReportsByEntity")
        return [self.connector._struct_to_dict(comps[0]["components"], e)
                for e in self._call("report", "getReportsByEntity", entity_id)]

    # Sharing
    def share_grant(self, data_id, data_type, to_agency, from_agency, access_level,
                    duration_hours, data_hash, purpose, officer_badge_id):
        result = self._send("agency_share", "grantAccess", data_id, data_type,
                            self._agency(to_agency), self._agency(from_agency),
                            self._level(access_level), duration_hours, self._b32(data_hash), purpose)
        return result  # permission id resolved below by the chain service

    def share_check(self, permission_id):
        has_access, level = self._call("agency_share", "checkAccess", permission_id)
        return {"hasAccess": has_access, "level": self._level_name(level)}

    def share_revoke(self, permission_id, reason):
        return self._send("agency_share", "revokeAccess", permission_id, reason)

    def share_log_access(self, permission_id):
        return self._send("agency_share", "logAccess", permission_id)

    def share_list_by_data(self, data_id):
        comps = self.connector._abi_outputs("agency_share", "getPermissionsByData")
        return [self.connector._struct_to_dict(comps[0]["components"], e)
                for e in self._call("agency_share", "getPermissionsByData", data_id)]

    def share_list_by_agency(self, agency):
        comps = self.connector._abi_outputs("agency_share", "getPermissionsByAgency")
        return [self.connector._struct_to_dict(comps[0]["components"], e)
                for e in self._call("agency_share", "getPermissionsByAgency", self._agency(agency))]

    # ── Helpers ───────────────────────────────────────────────────────────────
    @staticmethod
    def _b32(hex_digest: str) -> bytes:
        """Coerce any hex digest into exactly 32 bytes (Solidity `bytes32`)."""
        raw = (hex_digest or "").replace("0x", "") or "00"
        if len(raw) != 64:
            raw = hashlib.sha256(raw.encode("utf-8")).hexdigest()
        return bytes.fromhex(raw)

    @staticmethod
    def _sig_bytes(signature: str) -> bytes:
        """Decode a base64 (or hmac-prefixed) digital signature to raw bytes."""
        sig = signature or ""
        if sig.startswith("hmac:"):
            sig = sig[5:]
        try:
            return base64.b64decode(sig)
        except Exception:  # noqa: BLE001
            return hashlib.sha256(sig.encode("utf-8")).digest()

    @staticmethod
    def _agency(name: str) -> int:
        return {"STATE_POLICE": 0, "CBI": 1, "NIA": 2, "COURT": 3,
                "INTERPOL": 4, "CUSTOMS": 5, "NCB": 6}.get(name.upper(), 0)

    @staticmethod
    def _level(name: str) -> int:
        return {"READ_ONLY": 0, "FULL_ACCESS": 1, "ANALYSIS_ONLY": 2}.get(name.upper(), 0)

    @staticmethod
    def _level_name(idx: int) -> str:
        return {0: "READ_ONLY", 1: "FULL_ACCESS", 2: "ANALYSIS_ONLY"}.get(idx, "READ_ONLY")


# ─────────────────────────────────────────────────────────────────────────────
# CONNECTOR (singleton facade)
# ─────────────────────────────────────────────────────────────────────────────
class Web3Connector:
    """Selects the Web3 backend or the local ledger, exposing one interface."""

    def __init__(self) -> None:
        self.w3: Optional[Any] = None
        self.is_connected = False
        self.mode = "offline"
        self.contracts: dict[str, Any] = {}
        self.addresses: dict[str, str] = {}
        self.default_account: Optional[str] = None
        self.backend: Any = None

        self._try_web3()
        if not self.is_connected:
            self.backend = LocalLedger()
            logger.info("Blockchain backend: local ledger (offline mode)")

    # ── Web3 initialisation ───────────────────────────────────────────────────
    def _try_web3(self) -> None:
        try:
            from web3 import Web3

            w3 = Web3(Web3.HTTPProvider(WEB3_PROVIDER_URI))
            if not w3.is_connected():
                logger.warning("Web3 node unreachable at %s", WEB3_PROVIDER_URI)
                return
            meta = self._load_deployment()
            if not meta:
                logger.warning("Web3 node reachable but no deployed contracts found")
                return
            self.w3 = w3
            self.is_connected = True
            self.mode = "web3"
            self.default_account = w3.eth.accounts[0]
            for key, spec in meta["contracts"].items():
                self.addresses[key] = spec["address"]
                self.contracts[key] = w3.eth.contract(
                    address=spec["address"], abi=spec["abi"]
                )
            self.backend = Web3Backend(self)
            logger.info(
                "Blockchain backend: web3 (chain %s, block %s)",
                w3.eth.chain_id, w3.eth.block_number,
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("Web3 initialisation failed (%s); offline mode", exc)

    def _load_deployment(self) -> Optional[dict[str, Any]]:
        for path in CONTRACT_JSON_PATHS:
            if path and path.exists():
                try:
                    return json.loads(path.read_text(encoding="utf-8"))
                except (json.JSONDecodeError, OSError) as exc:
                    logger.warning("Bad deployment file %s: %s", path, exc)
        return None

    # ── Shared helpers ────────────────────────────────────────────────────────
    def get_contract(self, name: str) -> Any:
        if name not in self.contracts:
            raise KeyError(f"Unknown contract: {name}")
        return self.contracts[name]

    def _abi_outputs(self, contract_key: str, fn_name: str) -> list[dict[str, Any]]:
        contract = self.contracts[contract_key]
        abi = contract.abi
        for fn in abi:
            if fn.get("type") == "function" and fn.get("name") == fn_name:
                return fn.get("outputs", [])
        return []

    @staticmethod
    def _struct_to_dict(components: list[dict[str, Any]], values: Any) -> dict[str, Any]:
        """Map an ABI tuple result to a dict keyed by component name."""
        if not components:
            return {}
        if not isinstance(values, (list, tuple)):
            values = [values]
        result: dict[str, Any] = {}
        for i, comp in enumerate(components):
            name = comp.get("name") or f"field_{i}"
            value = values[i] if i < len(values) else None
            if isinstance(value, bytes):
                value = "0x" + value.hex()
            elif isinstance(value, (list, tuple)) and comp.get("components"):
                value = [Web3Connector._struct_to_dict(comp["components"], v) for v in value]
            result[name] = value
        return result

    # ── Convenience pass-throughs ─────────────────────────────────────────────
    def calculate_file_hash(self, file_bytes: bytes) -> str:
        from app.services.crypto_service import get_crypto_service

        return get_crypto_service().calculate_sha256(file_bytes)

    def calculate_data_hash(self, data_dict: dict[str, Any]) -> str:
        from app.services.crypto_service import get_crypto_service

        return get_crypto_service().hash_data_dict(data_dict)

    def get_account_for_officer(self, badge_id: str) -> str:
        if self.mode == "web3":
            try:
                import hashlib as _h

                idx = int(_h.sha256(badge_id.encode()).hexdigest(), 16) % len(self.w3.eth.accounts)
                return self.w3.eth.accounts[idx]
            except Exception:  # noqa: BLE001
                return self.default_account or "0x" + "0" * 40
        return LocalLedger._officer_address(badge_id)

    def get_network_status(self) -> dict[str, Any]:
        if self.mode == "web3":
            return {
                "connected": True,
                "mode": "web3",
                "network": "Ganache Local" if self.w3.eth.chain_id == 1337 else "Unknown",
                "chain_id": self.w3.eth.chain_id,
                "block_number": self.w3.eth.block_number,
            }
        stats = self.backend.stats()
        return {
            "connected": False,
            "mode": "offline",
            "network": "Local Ledger (no node)",
            "chain_id": CHAIN_ID,
            "block_number": stats.get("block_number", 0),
        }


# ── Module-level singleton ────────────────────────────────────────────────────
_connector: Optional[Web3Connector] = None


def get_web3_connector() -> Web3Connector:
    """Return the shared blockchain connector."""
    global _connector
    if _connector is None:
        _connector = Web3Connector()
    return _connector
