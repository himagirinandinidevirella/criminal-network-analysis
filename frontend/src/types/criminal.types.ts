/**
 * Criminal domain types shared across the frontend.
 */

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type CriminalStatus =
  | "WANTED"
  | "ARRESTED"
  | "UNDER_INVESTIGATION"
  | "CONVICTED"
  | "RELEASED"
  | "UNKNOWN";

/** A person (criminal) node in the knowledge graph. */
export interface Criminal {
  id: string;
  name: string;
  aliases: string[];
  age?: number | null;
  gender?: string | null;
  nationality?: string;
  address?: string | null;
  criminal_id?: string | null;
  risk_score: number;
  crime_types: string[];
  status: CriminalStatus;
  photo_url?: string | null;
  verified: boolean;
  important_flag: boolean;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

/** A vehicle node. */
export interface Vehicle {
  id: string;
  registration_number: string;
  type: string;
  make?: string | null;
  model?: string | null;
  color?: string | null;
  year?: number | null;
  owner_name?: string | null;
  seized: boolean;
  used_in_crimes: string[];
}

/** A financial account node. */
export interface Account {
  id: string;
  account_number: string;
  bank_name?: string | null;
  ifsc_code?: string | null;
  account_type: string;
  flagged: boolean;
  frozen: boolean;
  total_suspicious_amount: number;
  currency: string;
}

/** A crime event node. */
export interface CrimeEvent {
  id: string;
  crime_type: string;
  date?: string;
  severity: string;
  description?: string | null;
  status: string;
  case_number?: string | null;
}

/** An associate relationship shown on the profile page. */
export interface Associate {
  id: string;
  name: string;
  risk_score: number;
  crime_types: string[];
  relation: string;
}

/** A single factor contributing to a risk score (SHAP-style). */
export interface RiskFactor {
  feature: string;
  contribution: number;
  value: number;
}

/** A full risk assessment. */
export interface RiskAssessment {
  score: number;
  level: RiskLevel;
  color: string;
  factors: RiskFactor[];
  engine?: string;
  criminal_id?: string;
  history?: Array<{ month: number; score: number }>;
}

/** The complete profile bundle returned by GET /api/criminals/{id}. */
export interface CriminalProfile {
  person: Criminal;
  vehicles: Vehicle[];
  accounts: Account[];
  associates: Associate[];
  crimes: CrimeEvent[];
  risk: RiskAssessment;
  network_stats: Record<string, number>;
}

/** A timeline event. */
export interface TimelineEvent {
  date: string;
  kind: "CRIME" | "COMMUNICATION" | "FINANCIAL";
  label: string;
  detail?: string;
  case_number?: string;
}

/** Extracted entity from FIR analysis. */
export interface ExtractedEntity {
  text: string;
  type: string;
  confidence: number;
  source: string;
  meta?: Record<string, unknown>;
}

/** FIR analysis result. */
export interface FIRAnalysisResult {
  entities: ExtractedEntity[];
  relationships: Array<{ source: string; relation: string; target: string }>;
  created: Record<string, number>;
  quality_score?: number;
  model?: Record<string, unknown>;
}
