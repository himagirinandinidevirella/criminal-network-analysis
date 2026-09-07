/**
 * EvidenceVerifier — standalone tamper-detection tool: drop a file, enter its
 * evidence id, and get an INTACT / TAMPERED verdict against the chain.
 */
import { useRef, useState } from "react";
import { Fingerprint, UploadCloud, ShieldCheck, ShieldAlert, ShieldOff } from "lucide-react";
import { verifyEvidence } from "@/services/blockchainService";
import { successToast, errorToast } from "@/components/Common/ToastNotification";
import type { EvidenceVerification } from "@/types/blockchain.types";

export default function EvidenceVerifier() {
  const [evidenceId, setEvidenceId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<EvidenceVerification | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const run = async () => {
    if (!evidenceId || !file) {
      errorToast("Provide an evidence id and a file");
      return;
    }
    setVerifying(true);
    setResult(null);
    try {
      const res = await verifyEvidence(evidenceId, file);
      setResult(res);
      if (res.verified) successToast(res.message);
      else errorToast(res.message);
    } catch {
      errorToast("Verification request failed");
    } finally {
      setVerifying(false);
    }
  };

  const Icon = result
    ? result.verified
      ? ShieldCheck
      : result.integrity === "NOT_FOUND"
        ? ShieldOff
        : ShieldAlert
    : Fingerprint;
  const tone = result
    ? result.verified
      ? "text-risk-low"
      : "text-risk-critical"
    : "text-text-muted";

  return (
    <div className="glass rounded-2xl p-5">
      <div className="mb-4 flex items-center gap-2">
        <Fingerprint className="h-5 w-5 text-accent-cyan" />
        <h3 className="text-sm font-semibold">Tamper Detection</h3>
      </div>

      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <input
          value={evidenceId}
          onChange={(e) => setEvidenceId(e.target.value)}
          placeholder="Evidence ID (e.g. ev-…)"
          className="flex-1 rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-blue focus:outline-none"
        />
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <button
          onClick={() => inputRef.current?.click()}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-text-secondary transition hover:bg-bg-hover"
        >
          <UploadCloud className="h-4 w-4" /> {file ? file.name : "Choose file"}
        </button>
        <button
          onClick={run}
          disabled={verifying || !file || !evidenceId}
          className="rounded-lg bg-accent-blue px-4 py-2 text-sm font-semibold text-white transition hover:bg-seal-dark disabled:opacity-50"
        >
          {verifying ? "Verifying…" : "Verify"}
        </button>
      </div>

      {result && (
        <div
          className={`flex items-center gap-3 rounded-xl border p-4 ${
            result.verified ? "border-risk-low/40 bg-risk-low/10" : "border-risk-critical/40 bg-risk-critical/10"
          }`}
        >
          <Icon className={`h-8 w-8 ${tone}`} />
          <div className="text-sm">
            <div className={`font-bold ${tone}`}>{result.message}</div>
            <div className="mt-1 text-xs text-text-muted">
              Original timestamp: {result.original_timestamp || "—"} · Officer:{" "}
              {result.uploaded_by_officer || "—"}
            </div>
            <div className="mt-0.5 font-mono text-[11px] text-text-muted">{result.blockchain_proof}</div>
          </div>
        </div>
      )}
    </div>
  );
}
