/**
 * AuditTrailViewer — browse the immutable on-chain audit trail for a target
 * (criminal id, case number, report id, …) and for an officer's badge.
 */
import { useState } from "react";
import { ScrollText, Search, ShieldAlert, UserCheck } from "lucide-react";
import { getAuditTrail, getOfficerActivity, getSuspiciousActivity } from "@/services/blockchainService";
import { errorToast } from "@/components/Common/ToastNotification";
import type { AuditEntry } from "@/types/blockchain.types";

export default function AuditTrailViewer() {
  const [targetId, setTargetId] = useState("");
  const [officer, setOfficer] = useState("");
  const [records, setRecords] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");

  const loadTrail = async () => {
    if (!targetId) return;
    setLoading(true);
    try {
      const res = await getAuditTrail(targetId);
      setRecords(res.records);
      setTitle(`Audit trail for ${targetId} (${res.count} entries)`);
    } catch {
      errorToast("Unable to load audit trail");
    } finally {
      setLoading(false);
    }
  };

  const loadOfficer = async () => {
    if (!officer) return;
    setLoading(true);
    try {
      const res = await getOfficerActivity(officer);
      setRecords(res.records);
      setTitle(`Actions by ${officer} (${res.count} entries)`);
    } catch {
      errorToast("Unable to load officer activity");
    } finally {
      setLoading(false);
    }
  };

  const loadSuspicious = async () => {
    setLoading(true);
    try {
      const res = await getSuspiciousActivity();
      setRecords(res.records);
      setTitle(`Suspicious activity (${res.count} entries)`);
    } catch {
      errorToast("Unable to load suspicious activity");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass rounded-2xl p-5">
      <div className="mb-4 flex items-center gap-2">
        <ScrollText className="h-5 w-5 text-accent-cyan" />
        <h3 className="text-sm font-semibold">Immutable Audit Trail</h3>
      </div>

      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <input
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && loadTrail()}
          placeholder="Target ID (criminal / case / report)"
          className="flex-1 rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-blue focus:outline-none"
        />
        <button
          onClick={loadTrail}
          disabled={!targetId || loading}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-text-secondary transition hover:bg-bg-hover disabled:opacity-50"
        >
          <Search className="h-4 w-4" /> Trail
        </button>
        <input
          value={officer}
          onChange={(e) => setOfficer(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && loadOfficer()}
          placeholder="Officer badge"
          className="flex-1 rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-blue focus:outline-none"
        />
        <button
          onClick={loadOfficer}
          disabled={!officer || loading}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-text-secondary transition hover:bg-bg-hover disabled:opacity-50"
        >
          <UserCheck className="h-4 w-4" /> Officer
        </button>
        <button
          onClick={loadSuspicious}
          disabled={loading}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-risk-critical/40 bg-risk-critical/10 px-3 py-2 text-sm text-risk-critical transition hover:bg-risk-critical/20 disabled:opacity-50"
        >
          <ShieldAlert className="h-4 w-4" /> Suspicious
        </button>
      </div>

      {title && <p className="mb-2 text-xs font-semibold text-text-muted">{title}</p>}

      {loading ? (
        <p className="py-6 text-center text-xs text-text-muted">Loading…</p>
      ) : records.length === 0 ? (
        <p className="rounded-lg bg-bg-tertiary/50 py-6 text-center text-xs text-text-muted">
          No audit entries to display.
        </p>
      ) : (
        <ul className="max-h-96 space-y-1.5 overflow-y-auto pr-1">
          {records.map((r, i) => (
            <li
              key={`${r.logId}-${i}`}
              className="flex items-center gap-3 rounded-lg border border-border/60 bg-bg-tertiary/50 px-3 py-2 text-xs"
            >
              <span className={`h-2 w-2 shrink-0 rounded-full ${r.result === "UNAUTHORIZED" ? "bg-risk-critical" : "bg-risk-low"}`} />
              <span className="font-mono text-[11px] text-text-muted">{r.formattedTimestamp ?? "—"}</span>
              <span className="font-semibold text-text-primary">{r.action}</span>
              <span className="truncate text-text-secondary">{r.targetId}</span>
              <span className="ml-auto shrink-0 text-text-muted">{r.officerBadgeId}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
