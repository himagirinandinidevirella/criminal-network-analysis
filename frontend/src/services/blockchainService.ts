/**
 * Blockchain & cybersecurity service layer.
 *
 * Thin typed wrappers around the API client for every /api/blockchain and
 * /api/cybercrime endpoint. All calls go through the shared axios client so
 * JWT injection and error handling are consistent with the rest of the app.
 */
import { get, post, postForm } from "@/services/api";
import type {
  AccessCheck,
  AccessLevel,
  AgencyName,
  AuditEntry,
  BlockchainStatus,
  CyberDetection,
  CyberThreatRow,
  EvidenceRecord,
  EvidenceUploadResult,
  EvidenceVerification,
  IntegrityResult,
  LedgerTransaction,
  RecordCommitResult,
  RecordUpdate,
  ReportCertificate,
  ReportRegistration,
  ReportVerification,
  ShareGrantResult,
  SharePermission,
  UrlScanResult,
  WalletScanResult,
} from "@/types/blockchain.types";

// ── Status ───────────────────────────────────────────────────────────────────
export function getBlockchainStatus(): Promise<BlockchainStatus> {
  return get<BlockchainStatus>("/api/blockchain/status");
}

export function getRecentTransactions(): Promise<{ transactions: LedgerTransaction[] }> {
  return get<{ transactions: LedgerTransaction[] }>("/api/blockchain/transactions");
}

// ── Evidence ─────────────────────────────────────────────────────────────────
export function uploadEvidence(
  criminalId: string,
  file: File,
  caseNumber: string,
  evidenceType: string,
  description: string
): Promise<EvidenceUploadResult> {
  const form = new FormData();
  form.append("file", file);
  form.append("case_number", caseNumber);
  form.append("evidence_type", evidenceType);
  form.append("description", description);
  return postForm<EvidenceUploadResult>(`/api/blockchain/evidence/${criminalId}`, form);
}

export function verifyEvidence(evidenceId: string, file: File): Promise<EvidenceVerification> {
  const form = new FormData();
  form.append("evidence_id", evidenceId);
  form.append("file", file);
  return postForm<EvidenceVerification>("/api/blockchain/evidence/verify", form);
}

export function getCaseEvidence(caseNumber: string): Promise<{ case_number: string; evidence: EvidenceRecord[] }> {
  return get(`/api/blockchain/evidence/case/${caseNumber}`);
}

export function getCriminalEvidence(criminalId: string): Promise<{ criminal_id: string; evidence: EvidenceRecord[] }> {
  return get(`/api/blockchain/evidence/criminal/${criminalId}`);
}

export function markCourtAdmissible(evidenceId: string): Promise<{ success: boolean; evidence_id: string }> {
  return post(`/api/blockchain/evidence/${evidenceId}/court-admissible`, {});
}

// ── Audit trail ──────────────────────────────────────────────────────────────
export function getAuditTrail(targetId: string): Promise<{ target_id: string; records: AuditEntry[]; count: number }> {
  return get(`/api/blockchain/audit/trail/${targetId}`);
}

export function getOfficerActivity(badge: string): Promise<{ officer_badge: string; records: AuditEntry[]; count: number }> {
  return get(`/api/blockchain/audit/officer/${badge}`);
}

export function getSuspiciousActivity(): Promise<{ records: AuditEntry[]; count: number }> {
  return get("/api/blockchain/audit/suspicious");
}

// ── Criminal records ─────────────────────────────────────────────────────────
export function commitRecord(
  criminalId: string,
  data: Record<string, unknown>,
  updateType?: string,
  previousData?: Record<string, unknown>,
  reason?: string
): Promise<RecordCommitResult> {
  return post(`/api/blockchain/records/${criminalId}`, {
    data,
    update_type: updateType ?? null,
    previous_data: previousData ?? null,
    reason: reason ?? null,
  });
}

export function getRecordHistory(criminalId: string): Promise<{ criminal_id: string; history: RecordUpdate[]; count: number }> {
  return get(`/api/blockchain/records/${criminalId}/history`);
}

export function verifyRecordIntegrity(criminalId: string, data: Record<string, unknown>): Promise<IntegrityResult> {
  return post(`/api/blockchain/records/${criminalId}/verify`, { data });
}

// ── Reports ──────────────────────────────────────────────────────────────────
export function registerReport(payload: {
  report_type: string;
  entity_id: string;
  classification?: string;
  content?: string;
  report_hash?: string;
}): Promise<ReportRegistration> {
  return post("/api/blockchain/reports/register", payload);
}

export function verifyReport(reportId: string, content?: string, reportHash?: string): Promise<ReportVerification> {
  return post("/api/blockchain/reports/verify", {
    report_id: reportId,
    content: content ?? null,
    report_hash: reportHash ?? null,
  });
}

export function getReportCertificate(reportId: string): Promise<ReportCertificate> {
  return get(`/api/blockchain/reports/${reportId}/certificate`);
}

// ── Agency sharing ───────────────────────────────────────────────────────────
export function grantShare(payload: {
  data_id: string;
  data_type?: string;
  to_agency: AgencyName;
  from_agency?: string;
  access_level?: AccessLevel;
  duration_hours?: number;
  purpose?: string;
  data?: Record<string, unknown>;
}): Promise<ShareGrantResult> {
  return post("/api/blockchain/share/grant", payload);
}

export function verifyShare(permissionId: string): Promise<AccessCheck> {
  return post("/api/blockchain/share/verify", { permission_id: permissionId });
}

export function revokeShare(permissionId: string, reason: string): Promise<{ success: boolean; permission_id: string }> {
  return post("/api/blockchain/share/revoke", { permission_id: permissionId, reason });
}

export function getDataPermissions(dataId: string): Promise<{ data_id: string; permissions: SharePermission[] }> {
  return get(`/api/blockchain/share/data/${dataId}`);
}

export function getAgencyPermissions(agency: string): Promise<{ agency: string; permissions: SharePermission[] }> {
  return get(`/api/blockchain/share/agency/${agency}`);
}

// ── Cyber-crime ──────────────────────────────────────────────────────────────
export function analyzeCyberEvidence(payload: {
  text?: string;
  crime_types?: string[];
  cyber_flags?: string[];
  description?: string;
}): Promise<CyberDetection> {
  return post("/api/cybercrime/analyze", payload);
}

export function detectCriminalCyber(criminalId: string): Promise<CyberDetection> {
  return post(`/api/cybercrime/detect/${criminalId}`, {});
}

export function getCyberRisk(criminalId: string): Promise<{
  criminal_id: string;
  name: string;
  cyber_risk_score: number;
  cyber_risk_level: string;
  color: string;
  detected_threats: Array<{ label: string; score: number }>;
}> {
  return get(`/api/cybercrime/risk/${criminalId}`);
}

export function getCyberThreats(limit = 50): Promise<{ threats: CyberThreatRow[]; count: number }> {
  return get(`/api/cybercrime/threats?limit=${limit}`);
}

export function scanUrl(url: string): Promise<UrlScanResult> {
  return post("/api/cybercrime/scan/url", { url });
}

export function scanWallet(address: string): Promise<WalletScanResult> {
  return post("/api/cybercrime/scan/wallet", { address });
}
