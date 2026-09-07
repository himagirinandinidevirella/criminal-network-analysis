"""
Blockchain integration layer.

Exposes the five on-chain capabilities (evidence integrity, immutable audit
trail, criminal-record history, report certificates, inter-agency sharing)
through a single connector that transparently selects between a live Web3
backend and a deterministic local ledger fallback.
"""

from app.blockchain.web3_connector import Web3Connector, get_web3_connector

__all__ = [
    "Web3Connector",
    "get_web3_connector",
    "EvidenceChain",
    "AuditChain",
    "RecordChain",
    "ReportChain",
    "AgencyShareChain",
]


def __getattr__(name):
    """Lazy-import the chain services (they pull in the crypto/IPFS singletons)."""
    if name == "EvidenceChain":
        from app.blockchain.evidence_chain import EvidenceChain
        return EvidenceChain
    if name == "AuditChain":
        from app.blockchain.audit_chain import AuditChain
        return AuditChain
    if name == "RecordChain":
        from app.blockchain.record_chain import RecordChain
        return RecordChain
    if name == "ReportChain":
        from app.blockchain.report_chain import ReportChain
        return ReportChain
    if name == "AgencyShareChain":
        from app.blockchain.agency_share_chain import AgencyShareChain
        return AgencyShareChain
    raise AttributeError(f"module 'app.blockchain' has no attribute {name!r}")
