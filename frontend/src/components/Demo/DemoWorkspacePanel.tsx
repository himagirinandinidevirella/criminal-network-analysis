import { useEffect, useState } from "react";
import { get } from "@/services/api";
import { WORKSPACE_CHANGED } from "@/demo/events";
import type { DemoNote, DemoEvidence, DemoAudit } from "@/demo/types";
import { formatDateTime } from "@/utils/formatters";

type Workspace = {
  notes: DemoNote[];
  evidence: DemoEvidence[];
  audit: DemoAudit[];
};
export default function DemoWorkspacePanel({
  criminalId,
}: {
  criminalId?: string;
}) {
  const [data, setData] = useState<Workspace | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      get<Workspace>(`/api/demo/workspace${criminalId ? `/${criminalId}` : ""}`)
        .then((result) => {
          if (!cancelled) {
            setData(result);
            setError("");
          }
        })
        .catch(() => {
          if (!cancelled) setError("Could not read local workspace history.");
        });
    load();
    window.addEventListener(WORKSPACE_CHANGED, load);
    return () => {
      cancelled = true;
      window.removeEventListener(WORKSPACE_CHANGED, load);
    };
  }, [criminalId]);
  return (
    <section className="glass mt-4 rounded-2xl p-4">
      <h2 className="text-sm font-semibold">Local workspace history</h2>
      <p className="mt-1 text-xs text-ink-soft">
        Stored in this browser, not on a blockchain. Only file names, sizes and
        checksums are saved.
      </p>
      {error && (
        <p className="mt-3 text-sm text-risk-critical" role="alert">
          {error}
        </p>
      )}
      {!data && !error && (
        <p className="mt-3 text-sm text-ink-soft">Loading local history…</p>
      )}
      {data && (
        <div className="mt-4 grid gap-5 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
              Notes ({data.notes.length})
            </h3>
            <ul className="space-y-2">
              {data.notes.map((n) => (
                <li key={n.id} className="rounded-lg bg-paper-sunk p-3">
                  <p className="whitespace-pre-wrap break-words text-sm">
                    {n.content}
                  </p>
                  <p className="mt-1 text-[11px] text-ink-soft">
                    {n.officer} · {formatDateTime(n.created_at)}
                  </p>
                </li>
              ))}
            </ul>
            {!data.notes.length && (
              <p className="text-xs text-ink-soft">
                No notes yet. Use the Notes action below.
              </p>
            )}
          </div>
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
              File checksums ({data.evidence.length})
            </h3>
            <ul className="space-y-2">
              {data.evidence.map((e) => (
                <li key={e.id} className="rounded-lg bg-paper-sunk p-3">
                  <p className="break-words text-sm font-medium">
                    {e.file_name}{" "}
                    <span className="text-xs font-normal text-ink-soft">
                      ({e.size.toLocaleString()} bytes)
                    </span>
                  </p>
                  <code className="mt-1 block break-all text-[11px] text-teal">
                    SHA-256: {e.sha256}
                  </code>
                </li>
              ))}
            </ul>
            {!data.evidence.length && (
              <p className="text-xs text-ink-soft">
                No file checksums recorded yet.
              </p>
            )}
          </div>
          <div className="lg:col-span-2">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
              Recent local actions
            </h3>
            <ul className="space-y-1">
              {data.audit.slice(0, 6).map((a) => (
                <li key={a.id} className="break-words text-xs text-ink-soft">
                  <strong>{a.action.replace(/_/g, " ")}</strong> ·{" "}
                  {formatDateTime(a.created_at)} · {a.detail}
                </li>
              ))}
            </ul>
            {!data.audit.length && (
              <p className="text-xs text-ink-soft">
                Your actions will appear here.
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
