import { useEffect, useState } from "react";
import { Download, Share2, FileText } from "lucide-react";
import { get, getDownload } from "@/services/api";
import { formatDateTime } from "@/utils/formatters";
import { triggerDownload } from "@/utils/exportUtils";
import { errorToast } from "@/components/Common/ToastNotification";
import ShareReport from "@/components/Actions/ShareReport";
import { IS_DEMO } from "@/config/runtime";
import { WORKSPACE_CHANGED } from "@/demo/events";

interface HistoryRow {
  id: number | string;
  report_id?: string;
  title?: string;
  report_type: string;
  entity_id: string;
  format: string;
  file_url: string;
  created_at: string;
}
export default function ReportHistory({
  refreshKey = 0,
}: {
  refreshKey?: number;
}) {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | number | null>(null);
  const [shareId, setShareId] = useState("");
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      get<HistoryRow[]>("/api/reports/history")
        .then((r) => {
          if (!cancelled) {
            setRows(r);
            setError("");
          }
        })
        .catch(() => {
          if (!cancelled) setError("Report history is unavailable.");
        });
    load();
    if (IS_DEMO) window.addEventListener(WORKSPACE_CHANGED, load);
    return () => {
      cancelled = true;
      window.removeEventListener(WORKSPACE_CHANGED, load);
    };
  }, [refreshKey]);
  const download = async (row: HistoryRow) => {
    setBusy(row.id);
    try {
      const id = row.report_id || String(row.id);
      const blob = await getDownload(
        `/api/reports/${encodeURIComponent(id)}/download`,
      );
      triggerDownload(
        blob,
        `${IS_DEMO ? "demo_" : ""}${row.report_type}_${id.slice(0, 8)}.${row.format === "EXCEL" ? "xlsx" : row.format.toLowerCase()}`,
      );
    } catch {
      errorToast(
        "Could not download this report. It may no longer be available.",
      );
    } finally {
      setBusy(null);
    }
  };
  return (
    <section className="glass rounded-2xl p-4">
      <h2 className="mb-3 text-sm font-semibold">Report History</h2>
      {error ? (
        <p role="alert" className="text-xs text-risk-critical">
          {error}
        </p>
      ) : !rows.length ? (
        <p className="py-4 text-center text-xs text-ink-soft">
          No reports generated yet
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.slice(0, 20).map((row) => (
            <li key={row.id} className="rounded-lg bg-paper-sunk p-3">
              <div className="flex items-start gap-2">
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" />
                <div className="min-w-0">
                  <p className="break-words text-xs font-semibold">
                    {row.title || `${row.report_type} — ${row.entity_id}`}
                  </p>
                  <p className="mt-1 text-[10px] text-ink-soft">
                    {formatDateTime(row.created_at)} ·{" "}
                    {row.format === "EXCEL" ? "XLSX" : row.format}
                  </p>
                </div>
              </div>
              <div className="mt-2 flex gap-3">
                <button
                  disabled={busy === row.id}
                  onClick={() => download(row)}
                  className="flex items-center gap-1 text-xs text-teal disabled:opacity-50"
                >
                  <Download className="h-3.5 w-3.5" />
                  {busy === row.id ? "Preparing…" : "Download"}
                </button>
                <button
                  onClick={() => setShareId(row.report_id || String(row.id))}
                  className="flex items-center gap-1 text-xs text-ink-soft"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  {IS_DEMO ? "Local preview" : "Share"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {shareId && (
        <ShareReport criminalId={shareId} onClose={() => setShareId("")} />
      )}
    </section>
  );
}
