/**
 * Export service — delegates to the backend export endpoints.
 */
import { postDownload } from "./api";
import { triggerDownload } from "@/utils/exportUtils";

export interface ReportRequest {
  sections?: string[];
  format: "PDF" | "CSV" | "EXCEL" | "JSON";
  classification: string;
  date_range?: Record<string, unknown>;
}

/** Generate + download a criminal profile report. */
export async function downloadCriminalReport(
  criminalId: string,
  body: ReportRequest
): Promise<void> {
  const blob = await postDownload(`/api/reports/criminal/${criminalId}`, body);
  triggerDownload(blob, `criminal_${criminalId}.${body.format.toLowerCase()}`);
}

/** Generate + download a network analysis report. */
export async function downloadNetworkReport(body: ReportRequest): Promise<void> {
  const blob = await postDownload("/api/reports/network", body);
  triggerDownload(blob, `network_report.${body.format.toLowerCase()}`);
}

/** Generate + download a case report. */
export async function downloadCaseReport(caseId: string, body: ReportRequest): Promise<void> {
  const blob = await postDownload(`/api/reports/case/${caseId}`, body);
  triggerDownload(blob, `case_${caseId}.${body.format.toLowerCase()}`);
}

/** Generate + download an executive summary. */
export async function downloadExecutiveReport(body: ReportRequest): Promise<void> {
  const blob = await postDownload("/api/reports/executive", body);
  triggerDownload(blob, `executive_summary.${body.format.toLowerCase()}`);
}
