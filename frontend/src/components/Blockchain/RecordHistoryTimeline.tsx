/**
 * RecordHistoryTimeline — append-only criminal record change history with
 * on-chain integrity verification (detects off-chain tampering).
 */
import { useState } from "react";
import { History, GitCommit, PlusCircle, ShieldCheck, ShieldAlert } from "lucide-react";
import { commitRecord, getRecordHistory, verifyRecordIntegrity } from "@/services/blockchainService";
import { successToast, errorToast } from "@/components/Common/ToastNotification";
import type { IntegrityResult, RecordUpdate } from "@/types/blockchain.types";

export default function RecordHistoryTimeline() {
  const [criminalId, setCriminalId] = useState("");
  const [field, setField] = useState("");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [history, setHistory] = useState<RecordUpdate[]>([]);
  const [integrity, setIntegrity] = useState<IntegrityResult | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async (id: string) => {
    setLoading(true);
    try {
      const res = await getRecordHistory(id);
      setHistory(res.history);
    } catch {
      errorToast("Unable to load record history");
    } finally {
      setLoading(false);
    }
  };

  const create = async () => {
    if (!criminalId || !field || !value) {
      errorToast("Provide criminal id, field and value");
      return;
    }
    try {
      await commitRecord(criminalId, { [field]: value }, "CREATE", {}, reason || "Initial record");
      successToast("Record committed to blockchain");
      setField("");
      setValue("");
      setReason("");
      load(criminalId);
    } catch {
      errorToast("Record commit failed");
    }
  };

  const verify = async () => {
    if (!criminalId) return;
    try {
      const res = await verifyRecordIntegrity(criminalId, { note: "current database state" });
      setIntegrity(res);
      if (res.intact) successToast("Record integrity INTACT");
      else errorToast("DATA MAY HAVE BEEN MODIFIED!");
    } catch {
      errorToast("Integrity check failed");
    }
  };

  return (
    <div className="glass rounded-2xl p-5">
      <div className="mb-4 flex items-center gap-2">
        <History className="h-5 w-5 text-accent-cyan" />
        <h3 className="text-sm font-semibold">Record Integrity</h3>
      </div>

      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <input
          value={criminalId}
          onChange={(e) => setCriminalId(e.target.value)}
          placeholder="Criminal ID"
          className="flex-1 rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-blue focus:outline-none"
        />
        <button
          onClick={() => load(criminalId)}
          disabled={!criminalId || loading}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-text-secondary transition hover:bg-bg-hover disabled:opacity-50"
        >
          <History className="h-4 w-4" /> Load history
        </button>
        <button
          onClick={verify}
          disabled={!criminalId}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-accent-cyan/40 bg-accent-cyan/10 px-3 py-2 text-sm text-accent-cyan transition hover:bg-accent-cyan/20 disabled:opacity-50"
        >
          <ShieldCheck className="h-4 w-4" /> Verify integrity
        </button>
      </div>

      {/* Commit a change */}
      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-4">
        <input
          value={field}
          onChange={(e) => setField(e.target.value)}
          placeholder="Field (e.g. risk_level)"
          className="rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-blue focus:outline-none"
        />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="New value"
          className="rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-blue focus:outline-none"
        />
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason"
          className="rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-blue focus:outline-none"
        />
        <button
          onClick={create}
          disabled={!criminalId || !field || !value}
          className="flex items-center justify-center gap-1.5 rounded-lg bg-accent-blue px-3 py-2 text-sm font-semibold text-white transition hover:bg-seal-dark disabled:opacity-50"
        >
          <PlusCircle className="h-4 w-4" /> Commit update
        </button>
      </div>

      {integrity && (
        <div
          className={`mb-4 flex items-center gap-3 rounded-xl border p-3 text-sm ${
            integrity.intact ? "border-risk-low/40 bg-risk-low/10" : "border-risk-critical/40 bg-risk-critical/10"
          }`}
        >
          {integrity.intact ? (
            <ShieldCheck className="h-6 w-6 text-risk-low" />
          ) : (
            <ShieldAlert className="h-6 w-6 text-risk-critical" />
          )}
          <div>
            <div className={`font-bold ${integrity.intact ? "text-risk-low" : "text-risk-critical"}`}>
              {integrity.intact ? "Record integrity INTACT" : "DATA MAY HAVE BEEN MODIFIED!"}
            </div>
            <div className="mt-0.5 font-mono text-[11px] text-text-muted">
              chain: {integrity.blockchain_hash?.slice(0, 18) ?? "none"}… · db: {integrity.current_hash.slice(0, 18)}…
            </div>
          </div>
        </div>
      )}

      {/* History timeline */}
      {history.length === 0 ? (
        <p className="rounded-lg bg-bg-tertiary/50 py-6 text-center text-xs text-text-muted">
          No record history — load a criminal id above.
        </p>
      ) : (
        <ol className="relative ml-3 space-y-3 border-l border-border pl-4">
          {history.map((h) => (
            <li key={h.updateId} className="relative">
              <span className="absolute -left-[21px] top-1 flex h-4 w-4 items-center justify-center rounded-full bg-bg-tertiary ring-1 ring-border">
                <GitCommit className="h-2.5 w-2.5 text-accent-cyan" />
              </span>
              <div className="text-xs">
                <span className="font-semibold text-text-primary">{h.updateType}</span>
                <span className="text-text-muted"> · {h.formattedTimestamp ?? "—"} · {h.officerBadgeId}</span>
              </div>
              <div className="mt-0.5 text-xs text-text-secondary">
                {h.previousValue?.slice(0, 60)} → {h.newValue?.slice(0, 60)}
              </div>
              <div className="mt-0.5 text-[11px] text-text-muted">
                Reason: {h.reason} · <span className="font-mono">hash {h.dataHash.slice(0, 16)}…</span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
