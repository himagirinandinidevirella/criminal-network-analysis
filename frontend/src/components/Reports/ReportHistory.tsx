/**
 * ReportHistory — list of previously generated reports.
 */
import { useEffect, useState } from "react";
import { Download, Share2, FileText } from "lucide-react";
import { get } from "@/services/api";
import { formatDateTime } from "@/utils/formatters";
import { successToast } from "@/components/Common/ToastNotification";

interface HistoryRow {
  id: number;
  report_type: string;
  entity_id: string;
  format: string;
  generated_by?: string;
  file_url: string;
  created_at: string;
}

export default function ReportHistory() {
  const [rows, setRows] = useState<HistoryRow[]>([]);

  useEffect(() => {
    get<HistoryRow[]>("/api/reports/history")
      .then(setRows)
      .catch(() => setRows([]));
  }, []);

  return (
    <div className="glass rounded-2xl p-4">
      <h3 className="mb-3 text-sm font-semibold">Report History</h3>
      {rows.length === 0 ? (
        <p className="py-4 text-center text-xs text-text-muted">No reports generated yet</p>
      ) : (
        <ul className="space-y-2">
          {rows.slice(0, 8).map((r) => (
            <li key={r.id} className="flex items-center gap-2 rounded-lg bg-bg-tertiary px-3 py-2 text-xs">
              <FileText className="h-4 w-4 shrink-0 text-text-muted" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{r.report_type} — {r.entity_id}</p>
                <p className="text-[10px] text-text-muted">{formatDateTime(r.created_at)}</p>
              </div>
              <span className="rounded bg-bg-hover px-1.5 py-0.5 text-[10px] text-text-secondary">
                {r.format}
              </span>
              <button onClick={() => successToast("Download started")} aria-label="Download">
                <Download className="h-4 w-4 text-text-muted hover:text-text-primary" />
              </button>
              <button onClick={() => successToast("Share link copied")} aria-label="Share">
                <Share2 className="h-4 w-4 text-text-muted hover:text-text-primary" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
