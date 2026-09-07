/**
 * Blockchain & cybersecurity domain types.
 *
 * Mirrors the backend responses from /api/blockchain/* and /api/cybercrime/*.
 */

// ── Network / status ─────────────────────────────────────────────────────────
export type BlockchainMode = "web3" | "offline";

export interface BlockchainNetwork {
  connected: boolean;
  mode: BlockchainMode;
  network: string;
  chain_id: number;
  block_number: number;
}

export interface LedgerStats {
  total_evidence: number;
  total_audit: number;
  total_records: number;
  total_reports: number;
  total_shares: number;
  block_number: number;
}

export interface BlockchainStatus {
  network: BlockchainNetwork;
  stats: LedgerStats;
  mode: BlockchainMode;
  note: string;
}

// ── Evidence ─────────────────────────────────────────────────────────────────
export interface EvidenceRecord {
  evidenceId: string;
  fileHash: string;
  ipfsHash: string;
  criminalId: string;
  caseNumber: string;
  officerBadgeId: string;
  timestamp: number;
  formattedTimestamp?: string;
  evidenceType: string;
  description: string;
  isValid: boolean;
  courtAdmissible: boolean;
  ipfsGatewayUrl?: string;
}

export interface EvidenceUploadResult {
  success: boolean;
  evidence_id: string;
  transaction_hash?: string | null;
  block_number?: number | null;
  file_hash: string;
  ipfs_hash: string;
  blockchain_timestamp?: string;
  gas_used?: number | null;
  ipfs_gateway_url?: string;
  file_name?: string;
  file_size?: number;
}

export type EvidenceIntegrity = "INTACT" | "TAMPERED" | "NOT_FOUND";

export interface EvidenceVerification {
  verified: boolean;
  message: string;
  integrity: EvidenceIntegrity;
  original_timestamp?: string;
  uploaded_by_officer?: string;
  court_admissible?: boolean;
  blockchain_proof?: string;
}

// ── Audit trail ──────────────────────────────────────────────────────────────
export interface AuditEntry {
  logId: number;
  officerBadgeId: string;
  officerDepartment: string;
  action: string;
  targetId: string;
  targetType: string;
  timestamp: number;
  formattedTimestamp?: string;
  ipHash: string;
  result: string;
}

// ── Criminal records ─────────────────────────────────────────────────────────
export interface RecordUpdate {
  updateId: number;
  updateType: string;
  previousValue: string;
  newValue: string;
  officerBadgeId: string;
  timestamp: number;
  formattedTimestamp?: string;
  reason: string;
  dataHash: string;
}

export interface RecordCommitResult {
  success: boolean;
  criminal_id: string;
  data_hash?: string;
  new_hash?: string;
  update_type?: string;
  transaction_hash?: string | null;
  block_number?: number | null;
}

export interface IntegrityResult {
  intact: boolean;
  blockchain_hash?: string | null;
  current_hash: string;
  last_verified: string;
  warning?: string | null;
}

// ── Reports ──────────────────────────────────────────────────────────────────
export interface ReportCertificate {
  report_id: string;
  classification: string;
  report_hash: string;
  registered_at?: string;
  transaction_hash?: string | null;
  network?: string;
}

export interface ReportRegistration {
  success: boolean;
  report_id: string;
  report_hash: string;
  transaction_hash?: string | null;
  block_number?: number | null;
  certificate: ReportCertificate;
}

export interface ReportVerification {
  authentic: boolean;
  generated_at?: string;
  generated_by?: string;
  classification?: string;
  blockchain_certificate?: string;
  court_valid: boolean;
}

// ── Agency sharing ───────────────────────────────────────────────────────────
export type AgencyName =
  | "STATE_POLICE"
  | "CBI"
  | "NIA"
  | "COURT"
  | "INTERPOL"
  | "CUSTOMS"
  | "NCB";

export type AccessLevel = "READ_ONLY" | "FULL_ACCESS" | "ANALYSIS_ONLY";

export interface SharePermission {
  permissionId: string;
  dataId: string;
  dataType: string;
  fromAgency: string;
  toAgency: string;
  accessLevel: AccessLevel;
  grantedAt: number;
  expiresAt: number;
  formattedExpiry?: string;
  isActive: boolean;
  purpose: string;
  accessCount: number;
}

export interface ShareGrantResult {
  permission_id: string;
  data_id: string;
  from_agency: string;
  to_agency: string;
  access_level: AccessLevel;
  expires_at?: string;
  share_url: string;
  transaction_hash?: string;
}

export interface AccessCheck {
  permission_id: string;
  hasAccess: boolean;
  level: AccessLevel;
}

// ── Ledger transactions ──────────────────────────────────────────────────────
export interface LedgerTransaction {
  kind: string;
  action: string;
  timestamp: number;
  block_number: number;
  transaction_hash: string;
}

// ── Cyber-crime ──────────────────────────────────────────────────────────────
export type CyberRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type CyberCategoryKey =
  | "ransomware"
  | "phishing"
  | "crypto_laundering"
  | "dark_web"
  | "coordinated_attack"
  | "social_engineering";

export interface CyberCategory {
  label: string;
  detected: boolean;
  score: number;
  confidence: number;
  indicator_count: number;
  indicators: string[];
}

export interface CyberDetection {
  cyber_risk_score: number;
  cyber_risk_level: CyberRiskLevel;
  color: string;
  categories: Record<CyberCategoryKey, CyberCategory>;
  detected_threats: CyberCategory[];
  indicators: string[];
  summary: string;
  recommendations: string[];
  engine: string;
  criminal_id?: string;
  name?: string;
}

export interface CyberThreatRow {
  criminal_id: string;
  name: string;
  cyber_risk_score: number;
  cyber_risk_level: CyberRiskLevel;
  top_threats: string[];
}

export interface UrlScanResult {
  url: string;
  host: string;
  threat_score: number;
  threat_level: CyberRiskLevel;
  flags: string[];
  verdict: "BLOCK" | "CAUTION" | "ALLOW";
}

export interface WalletScanResult {
  address: string;
  currency: "BTC" | "ETH" | "XMR" | "UNKNOWN";
  threat_score: number;
  threat_level: CyberRiskLevel;
  flags: string[];
  verdict: "FLAG" | "MONITOR" | "CLEAR";
}
