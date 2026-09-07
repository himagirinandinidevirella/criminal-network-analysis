/**
 * ReportGenerator — configure and generate case/network/executive reports.
 */
import { useEffect, useState } from "react";
import { FileBarChart, FileText, Download, Share2, Loader2 } from "lucide-react";
import { get } from "@/services/api";
import { downloadCriminalReport, downloadNetworkReport, downloadExecutiveReport } from "@/services/exportService";
import type { Criminal } from "@/types/criminal.types";
import type { Paginated } from "@/types/api.types";
import { successToast, errorToast } from "@/components/Common/ToastNotification";
import { formatDateTime } from "@/utils/formatters";
import ReportHistory from "./ReportHistory";
import ExportOptions from "./ExportOptions";

type ReportType = "criminal" | "network" | "case" | "executive";
type Format = "PDF" | "CSV" | "EXCEL" | "JSON";

const REPORT_TYPES: Array<{ id: ReportType; label: string; icon: typeof FileText }> = [
  { id: "criminal", label: "Criminal Profile Report", icon: FileText },
  { id: "network", label: "Network Analysis Report", icon: FileBarChart },
  { id: "case", label: "Case Investigation Report", icon: FileText },
  { id: "executive", label: "Executive Summary Report", icon: FileBarChart },
];

const SECTIONS = [
  "Personal Profile", "Network Map", "Risk Assessment + SHAP", "Crime History Timeline",
  "Vehicle Details", "Account/Financial Analysis", "Associate Profiles",
  "Anomaly Report", "Predictive Analysis", "Recommendations",
];

export default function ReportGenerator() {
  const [reportType, setReportType] = useState<ReportType>("criminal");
  const [criminalId, setCriminalId] = useState("");
  const [options, setOptions] = useState<Criminal[]>([]);
  const [classification, setClassification] = useState("CONFIDENTIAL");
  const [format, setFormat] = useState<Format>("PDF");
  const [sections, setSections] = useState<Record<string, boolean>>(
    Object.fromEntries(SECTIONS.map((s) => [s, true]))
  );
  const [watermark, setWatermark] = useState(true);
  const [progress, setProgress] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    get<Paginated<Criminal>>("/api/criminals/?limit=50&sort_by=risk_score")
      .then((r) => setOptions(r.items))
      .catch(() => setOptions([]));
  }, []);

  const generate = async () => {
    setGenerating(true);
    setProgress(["Fetching data..."]);
    const sectionList = SECTIONS.filter((s) => sections[s]);

    try {
      setProgress((p) => [...p, "Running AI analysis..."]);
      const body = {
        sections: sectionList,
        format,
        classification: watermark ? classification : "UNCLASSIFIED",
        date_range: { start: "2024-01-01", end: "2025-01-01" },
      };
      if (reportType === "criminal") {
        if (!criminalId) throw new Error("Select a criminal");
        await downloadCriminalReport(criminalId, body);
      } else if (reportType === "network") {
        await downloadNetworkReport(body);
      } else if (reportType === "executive") {
        await downloadExecutiveReport(body);
      } else {
        await downloadExecutiveReport(body); // case reports reuse the executive pipeline for demo
      }
      setProgress((p) => [...p, "Creating visualizations... 75%", "Done!"]);
      successToast("Report generated");
    } catch {
      errorToast("Report generation failed");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Report Generator</h1>
        <p className="text-sm text-text-secondary">Generate professional investigation reports</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="glass space-y-4 rounded-2xl p-4 lg:col-span-2">
          {/* Report type selection */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {REPORT_TYPES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setReportType(id)}
                className={`flex items-center gap-2 rounded-xl border p-3 text-left text-sm transition ${
                  reportType === id
                    ? "border-seal bg-seal-soft text-seal"
                    : "border-paper-line bg-paper-raised text-ink-soft hover:bg-paper-sunk"
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" /> {label}
              </button>
            ))}
          </div>

          {/* Configuration */}
          {reportType === "criminal" && (
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Criminal</label>
              <select
                value={criminalId}
                onChange={(e) => setCriminalId(e.target.value)}
                className="w-full rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary"
              >
                <option value="">Select criminal…</option>
                {options.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.criminal_id})</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Classification</label>
              <select
                value={classification}
                onChange={(e) => setClassification(e.target.value)}
                className="w-full rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary"
              >
                {["CONFIDENTIAL", "SECRET", "TOP SECRET", "RESTRICTED"].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Date range</label>
              <input
                type="text"
                value="01/01/2024 — Today"
                disabled
                className="w-full rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-muted"
              />
            </div>
          </div>

          {/* Sections */}
          <div>
            <p className="mb-2 text-xs font-medium text-text-secondary">Include sections</p>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {SECTIONS.map((s) => (
                <label key={s} className="flex items-center gap-2 text-xs text-text-secondary">
                  <input
                    type="checkbox"
                    checked={sections[s]}
                    onChange={(e) => setSections((prev) => ({ ...prev, [s]: e.target.checked }))}
                    className="rounded border-border accent-accent-blue"
                  />
                  {s}
                </label>
              ))}
            </div>
          </div>

          <ExportOptions format={format} onFormatChange={setFormat} watermark={watermark} onWatermarkChange={setWatermark} />

          {/* Generate */}
          <button
            onClick={generate}
            disabled={generating}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent-blue py-3 text-sm font-bold text-white transition hover:bg-seal-dark disabled:opacity-60"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            GENERATE REPORT
          </button>

          {progress.length > 0 && (
            <ul className="space-y-1 text-xs text-text-secondary">
              {progress.map((p, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className={i === progress.length - 1 && !generating ? "text-risk-low" : ""}>
                    {i === progress.length - 1 && !generating ? "✅" : i === progress.length - 1 ? "⏳" : "✅"}
                  </span>
                  {p}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-4">
          <ReportHistory />
          <div className="glass rounded-2xl p-4 text-xs text-text-secondary">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-text-primary">
              <Share2 className="h-4 w-4" /> Sharing
            </h3>
            <p>Reports can be shared via secure expiring links (24h / 7 days / 30 days) with View or Download access.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
