import type { CCTVTrackingTrail } from "@/types/cctvTracking.types";
import type {
  Account,
  Criminal,
  CrimeEvent,
  Vehicle,
} from "@/types/criminal.types";
import type { Alert, AlertRule } from "@/types/alert.types";
import type { GraphEdge } from "@/types/network.types";

export interface DemoLocation {
  id: string;
  name: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
}
export interface DemoOrganization {
  id: string;
  name: string;
  crime_types: string[];
}
export interface DemoCrime extends CrimeEvent {
  person_ids: string[];
  location_id: string;
}
export interface DemoTransaction {
  id: string;
  name: string;
  from_account: string;
  to_account: string;
  amount: number;
  currency: string;
  date: string;
  flagged: boolean;
}
export interface DemoNote {
  id: string;
  criminal_id: string;
  content: string;
  officer: string;
  created_at: string;
}
export interface DemoEvidence {
  id: string;
  criminal_id: string;
  file_name: string;
  size: number;
  sha256: string;
  created_at: string;
}
export interface DemoAudit {
  id: string;
  target_id: string;
  action: string;
  detail: string;
  created_at: string;
}
export type ReportFormat = "PDF" | "CSV" | "EXCEL" | "JSON";
export type DemoReportType = "criminal" | "network" | "case" | "executive";
export interface DemoReport {
  id: string;
  title: string;
  report_type: DemoReportType;
  entity_id: string;
  format: ReportFormat;
  classification: string;
  created_at: string;
  notice: string;
  sections: Record<string, unknown>;
}
export interface DemoShare {
  token: string;
  report: DemoReport;
  access_level: "VIEW" | "DOWNLOAD";
  expires_at: number;
}
export interface DemoState {
  version: 1;
  cctv_trails?: CCTVTrackingTrail[];
  people: Criminal[];
  organizations: DemoOrganization[];
  locations: DemoLocation[];
  vehicles: Array<Vehicle & { owner_id: string }>;
  accounts: Array<Account & { owner_id: string }>;
  crimes: DemoCrime[];
  transactions: DemoTransaction[];
  edges: GraphEdge[];
  alerts: Alert[];
  rules: AlertRule[];
  notes: DemoNote[];
  evidence: DemoEvidence[];
  audit: DemoAudit[];
  reports: DemoReport[];
  shares: DemoShare[];
}
