/** Report choices are wired to real file downloads, not simulated progress. */
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FileBarChart, FileText, Download, Loader2 } from "lucide-react";
import { get, apiErrorMessage } from "@/services/api";
import {
  downloadCriminalReport,
  downloadNetworkReport,
  downloadExecutiveReport,
  downloadCaseReport,
} from "@/services/exportService";
import type { Criminal } from "@/types/criminal.types";
import type { Paginated } from "@/types/api.types";
import type { DemoCrime, DemoReportType, ReportFormat } from "@/demo/types";
import { DEMO_REPORT_SECTIONS } from "@/demo/reports";
import { IS_DEMO } from "@/config/runtime";
import {
  successToast,
  errorToast,
} from "@/components/Common/ToastNotification";
import ReportHistory from "./ReportHistory";
import ExportOptions from "./ExportOptions";

const TYPES: Array<{
  id: DemoReportType;
  label: string;
  icon: typeof FileText;
}> = [
  { id: "criminal", label: "Person Profile Report", icon: FileText },
  { id: "network", label: "Network Analysis Report", icon: FileBarChart },
  { id: "case", label: "Case Investigation Report", icon: FileText },
  { id: "executive", label: "Executive Summary Report", icon: FileBarChart },
];
const BACKEND_SECTIONS = [
  "Personal Profile",
  "Network Map",
  "Risk Assessment + SHAP",
  "Crime History Timeline",
  "Vehicle Details",
  "Account/Financial Analysis",
  "Associate Profiles",
  "Anomaly Report",
  "Predictive Analysis",
  "Recommendations",
];
export default function ReportGenerator() {
  const [params] = useSearchParams();
  const [type, setType] = useState<DemoReportType>("criminal");
  const [criminalId, setCriminalId] = useState(params.get("criminal") ?? "");
  const [caseId, setCaseId] = useState("");
  const [people, setPeople] = useState<Criminal[]>([]);
  const [cases, setCases] = useState<DemoCrime[]>([]);
  const [classification, setClassification] = useState(
    IS_DEMO ? "SYNTHETIC DEMO" : "CONFIDENTIAL",
  );
  const [format, setFormat] = useState<ReportFormat>("PDF");
  const [watermark, setWatermark] = useState(true);
  const available = IS_DEMO ? DEMO_REPORT_SECTIONS[type] : BACKEND_SECTIONS;
  const [sections, setSections] = useState<string[]>(available);
  const [generating, setGenerating] = useState(false);
  const [status, setStatus] = useState("");
  const [historyVersion, setHistoryVersion] = useState(0);
  const [loadError, setLoadError] = useState("");
  useEffect(() => {
    get<Paginated<Criminal>>("/api/criminals/?limit=50&sort_by=risk_score")
      .then((r) => setPeople(r.items))
      .catch(() =>
        setLoadError(
          "Could not load people. Reload or check the backend connection.",
        ),
      );
    if (IS_DEMO)
      get<DemoCrime[]>("/api/demo/cases")
        .then(setCases)
        .catch(() => setLoadError("Could not load demo cases."));
  }, []);
  useEffect(() => {
    setSections(IS_DEMO ? DEMO_REPORT_SECTIONS[type] : BACKEND_SECTIONS);
    setStatus("");
  }, [type]);
  const valid =
    sections.length > 0 &&
    (type !== "criminal" || !!criminalId) &&
    (type !== "case" || !!caseId.trim());
  const generate = async () => {
    if (!valid || generating) return;
    setGenerating(true);
    setStatus("Preparing your report…");
    try {
      const body = {
        sections,
        format,
        classification: watermark ? classification : "UNCLASSIFIED",
      };
      if (type === "criminal") await downloadCriminalReport(criminalId, body);
      else if (type === "network") await downloadNetworkReport(body);
      else if (type === "case") await downloadCaseReport(caseId.trim(), body);
      else await downloadExecutiveReport(body);
      setStatus(
        "Report downloaded. A snapshot is available in Report History.",
      );
      setHistoryVersion((v) => v + 1);
      successToast("Report generated and downloaded");
    } catch (error) {
      setStatus(`Could not generate report: ${apiErrorMessage(error)}`);
      errorToast("Report generation failed");
    } finally {
      setGenerating(false);
    }
  };
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Report Generator</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {IS_DEMO
            ? "Export synthetic findings as real, downloadable files."
            : "Configure and download investigation reports."}
        </p>
      </div>
      {IS_DEMO && (
        <p className="rounded-xl border border-teal/20 bg-teal-soft p-3 text-sm text-teal">
          Every export is labeled SYNTHETIC DEMO. No predictive analysis, court
          certification or blockchain sealing is performed.
        </p>
      )}
      {loadError && (
        <p role="alert" className="text-sm text-risk-critical">
          {loadError}
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="glass space-y-5 rounded-2xl p-5 lg:col-span-2">
          <div className="grid gap-2 sm:grid-cols-2">
            {TYPES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                disabled={generating}
                aria-pressed={type === id}
                onClick={() => setType(id)}
                className={`flex items-center gap-2 rounded-xl border p-3 text-left text-sm ${type === id ? "border-seal bg-seal-soft text-seal" : "border-paper-line text-ink-soft hover:bg-paper-sunk"}`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {label}
              </button>
            ))}
          </div>
          {type === "criminal" && (
            <div>
              <label
                htmlFor="report-person"
                className="mb-1 block text-xs font-semibold"
              >
                Person
              </label>
              <select
                id="report-person"
                value={criminalId}
                onChange={(e) => setCriminalId(e.target.value)}
                className="w-full rounded-lg border border-paper-line bg-paper-sunk px-3 py-2 text-sm"
              >
                <option value="">Select a person…</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.criminal_id})
                  </option>
                ))}
              </select>
            </div>
          )}
          {type === "case" && (
            <div>
              <label
                htmlFor="report-case"
                className="mb-1 block text-xs font-semibold"
              >
                Case
              </label>
              {IS_DEMO ? (
                <select
                  id="report-case"
                  value={caseId}
                  onChange={(e) => setCaseId(e.target.value)}
                  className="w-full rounded-lg border border-paper-line bg-paper-sunk px-3 py-2 text-sm"
                >
                  <option value="">Select a case…</option>
                  {cases.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.case_number} · {c.crime_type}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id="report-case"
                  value={caseId}
                  onChange={(e) => setCaseId(e.target.value)}
                  placeholder="Enter case ID"
                  className="w-full rounded-lg border border-paper-line bg-paper-sunk px-3 py-2 text-sm"
                />
              )}
            </div>
          )}
          {!IS_DEMO && (
            <div>
              <label
                htmlFor="report-classification"
                className="mb-1 block text-xs font-semibold"
              >
                Classification
              </label>
              <select
                id="report-classification"
                value={classification}
                onChange={(e) => setClassification(e.target.value)}
                className="w-full rounded-lg border border-paper-line bg-paper-sunk px-3 py-2 text-sm"
              >
                {["CONFIDENTIAL", "SECRET", "TOP SECRET", "RESTRICTED"].map(
                  (c) => (
                    <option key={c}>{c}</option>
                  ),
                )}
              </select>
            </div>
          )}
          <fieldset>
            <legend className="mb-2 text-xs font-semibold">
              Include sections
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {available.map((section) => (
                <label
                  key={section}
                  className="flex items-center gap-2 text-xs text-ink-soft"
                >
                  <input
                    type="checkbox"
                    checked={sections.includes(section)}
                    onChange={(e) =>
                      setSections((current) =>
                        e.target.checked
                          ? [...current, section]
                          : current.filter((s) => s !== section),
                      )
                    }
                    className="accent-seal"
                  />
                  {section}
                </label>
              ))}
            </div>
          </fieldset>
          <p className="text-xs text-ink-soft">
            Scope: all available records for the selected subject. Reports
            capture data at the time of generation.
          </p>
          <ExportOptions
            format={format}
            onFormatChange={setFormat}
            watermark={watermark}
            onWatermarkChange={setWatermark}
          />
          <button
            onClick={generate}
            disabled={generating || !valid}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-seal py-3 text-sm font-bold text-white hover:bg-seal-dark disabled:opacity-50"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {generating ? "Generating…" : "Generate report"}
          </button>
          {!valid && (
            <p className="text-xs text-ink-soft">
              Choose a subject (if needed) and at least one section to generate
              a report.
            </p>
          )}
          {status && (
            <p
              role="status"
              className="rounded-lg bg-paper-sunk p-3 text-sm text-ink-soft"
            >
              {status}
            </p>
          )}
        </section>
        <div className="space-y-4">
          <ReportHistory refreshKey={historyVersion} />
          <div className="glass rounded-2xl p-4 text-xs leading-relaxed text-ink-soft">
            <h2 className="mb-2 text-sm font-semibold text-ink">
              Report snapshots
            </h2>
            {IS_DEMO
              ? "The latest 20 generated reports are kept in this browser. Re-download the original snapshot or create a local preview. Download a file to share externally; local links do not work on other devices."
              : "Generated reports are listed in history. Sharing uses the configured backend service."}
          </div>
        </div>
      </div>
    </div>
  );
}
