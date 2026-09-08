/** A usable no-login entry screen and a read-only report snapshot view. */
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { FileText, Download } from "lucide-react";
import { get, postDownload } from "@/services/api";
import { IS_DEMO } from "@/config/runtime";
import { triggerDownload } from "@/utils/exportUtils";
import type { DemoReport } from "@/demo/types";
import LoadingSkeleton from "@/components/Common/LoadingSkeleton";
import ErrorState from "@/components/Common/ErrorState";
import ReportViewer from "@/components/Reports/ReportViewer";
import { errorToast } from "@/components/Common/ToastNotification";

interface PublicReportData {
  report_id: string;
  access_level: string;
  watermarked: boolean;
  notice: string;
  report?: DemoReport;
}
export default function PublicReport() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const [data, setData] = useState<PublicReportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    setLoading(Boolean(token));
    if (token)
      get<PublicReportData>(`/api/public/report/${encodeURIComponent(token)}`)
        .then((r) => {
          if (!cancelled) setData(r);
        })
        .catch(() => {
          if (!cancelled)
            setError(
              IS_DEMO
                ? "This local preview is invalid, expired, or was created in another browser. Try the sample report instead."
                : "This share link is invalid or has expired.",
            );
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    return () => {
      cancelled = true;
    };
  }, [token]);
  const download = async () => {
    setDownloading(true);
    try {
      const blob = await postDownload(`/api/public/report/${token}/download`);
      const extension = blob.type.includes("json")
        ? "json"
        : blob.type.includes("csv")
          ? "csv"
          : blob.type.includes("spreadsheet")
            ? "xlsx"
            : "pdf";
      triggerDownload(blob, `shared_report.${extension}`);
    } catch {
      errorToast("Could not download this shared report");
    } finally {
      setDownloading(false);
    }
  };
  return (
    <div className="min-h-screen bg-paper p-4 sm:p-8">
      <div className="mx-auto max-w-3xl space-y-4">
        <nav className="flex gap-4 text-sm text-teal">
          <Link to="/login">Sign in</Link>
          <Link to="/public">Report previews</Link>
        </nav>
        <section className="glass rounded-2xl p-6 sm:p-8">
          <FileText className="h-8 w-8 text-seal" />
          <h1 className="dossier-title mt-3 text-2xl font-bold">
            {token ? "Shared Report" : "Report previews"}
          </h1>
          <p className="mt-2 text-sm text-ink-soft">
            {IS_DEMO
              ? "Synthetic demonstration only. Local previews work in the browser that created them."
              : "Open a report using its sharing token or link."}
          </p>
          {!token && (
            <form
              className="mt-5 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                const value = input
                  .trim()
                  .split("/public/report/")
                  .pop()
                  ?.split(/[?#]/)[0];
                if (value)
                  navigate(`/public/report/${encodeURIComponent(value)}`);
              }}
            >
              <label
                htmlFor="share-token"
                className="block text-xs font-semibold"
              >
                Report token or link
              </label>
              <input
                id="share-token"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Paste a preview link or token"
                className="w-full rounded-lg border border-paper-line bg-paper-sunk p-3 text-sm"
              />
              <button
                disabled={!input.trim()}
                className="rounded-lg bg-seal px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Open report
              </button>
            </form>
          )}
          {IS_DEMO && (
            <Link
              to="/public/report/demo-token-2025"
              className="mt-4 inline-block text-sm font-semibold text-teal underline"
            >
              View sample report
            </Link>
          )}
          <div className="mt-5">
            {loading && <LoadingSkeleton lines={4} />}
            {error && <ErrorState message={error} />}
            {data && (
              <div className="space-y-4">
                <p className="rounded-lg bg-teal-soft p-3 text-xs leading-relaxed text-teal">
                  {data.notice}
                </p>
                <p className="text-xs text-ink-soft">
                  Access: {data.access_level} ·{" "}
                  {data.watermarked ? "Labeled copy" : "Shared copy"}
                </p>
                {data.report && (
                  <ReportViewer
                    title={data.report.title}
                    data={data.report.sections}
                  />
                )}
                {data.access_level === "DOWNLOAD" && (
                  <button
                    onClick={download}
                    disabled={downloading}
                    className="flex items-center gap-2 rounded-lg bg-seal px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    <Download className="h-4 w-4" />
                    {downloading
                      ? "Preparing…"
                      : IS_DEMO
                        ? "Download JSON snapshot"
                        : "Download report"}
                  </button>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
