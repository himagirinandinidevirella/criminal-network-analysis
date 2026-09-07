/**
 * PublicReport — read-only shared report view (no login required).
 */
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Shield, FileText } from "lucide-react";
import { get } from "@/services/api";
import LoadingSkeleton from "@/components/Common/LoadingSkeleton";
import ErrorState from "@/components/Common/ErrorState";

interface PublicReportData {
  report_id: string;
  access_level: string;
  watermarked: boolean;
  notice: string;
}

export default function PublicReport() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<PublicReportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    get<PublicReportData>(`/api/public/report/${token}`)
      .then(setData)
      .catch(() => setError("This share link is invalid or has expired."))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-primary p-4">
      <div className="glass w-full max-w-lg rounded-2xl p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-seal-soft text-seal">
          <FileText className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-bold">Shared Report</h1>
        <p className="mt-1 text-sm text-text-muted">CrimeNet AI — Public View</p>

        <div className="mt-6">
          {loading && <LoadingSkeleton lines={3} />}
          {error && <ErrorState message={error} />}
          {data && (
            <div className="space-y-3 text-left">
              <div className="rounded-lg bg-bg-tertiary p-4 text-sm">
                <p className="font-semibold text-text-primary">
                  Report #{data.report_id}
                </p>
                <p className="mt-1 text-xs text-text-secondary">{data.notice}</p>
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-[11px] text-risk-medium">
                  <Shield className="h-3 w-3" /> Watermarked · Access: {data.access_level}
                </p>
              </div>
              <p className="text-center text-xs text-text-muted">
                This is a read-only copy. For full access, request credentials from
                the investigating officer.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
