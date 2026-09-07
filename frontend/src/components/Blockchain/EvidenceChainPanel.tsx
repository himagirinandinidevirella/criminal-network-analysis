/**
 * EvidenceChainPanel — upload evidence to IPFS + chain, list case evidence,
 * and verify individual files against their immutable fingerprint.
 */
import { useRef, useState } from "react";
import {
  UploadCloud, ShieldCheck, Scale, Search, FileSearch, CheckCircle2, XCircle,
} from "lucide-react";
import { successToast, errorToast } from "@/components/Common/ToastNotification";
import {
  uploadEvidence, verifyEvidence, getCaseEvidence, markCourtAdmissible,
} from "@/services/blockchainService";
import type { EvidenceRecord, EvidenceVerification } from "@/types/blockchain.types";

interface VerdictState {
  evidenceId: string;
  result: EvidenceVerification;
}

export default function EvidenceChainPanel() {
  const [criminalId, setCriminalId] = useState("");
  const [caseNumber, setCaseNumber] = useState("");
  const [evidenceType, setEvidenceType] = useState("DIGITAL");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [listing, setListing] = useState(false);
  const [records, setRecords] = useState<EvidenceRecord[]>([]);
  const [verdicts, setVerdicts] = useState<Record<string, EvidenceVerification>>({});
  const fileInput = useRef<HTMLInputElement>(null);

  const handleUpload = async () => {
    if (!file || !criminalId || !caseNumber) {
      errorToast("Provide criminal id, case number and a file");
      return;
    }
    setUploading(true);
    try {
      const result = await uploadEvidence(criminalId, file, caseNumber, evidenceType, description);
      successToast(`Evidence secured on-chain (${result.ipfs_hash.slice(0, 10)}…)`);
      setFile(null);
      setDescription("");
      loadCaseEvidence(caseNumber);
    } catch {
      errorToast("Evidence upload failed");
    } finally {
      setUploading(false);
    }
  };

  const loadCaseEvidence = async (caseNo: string) => {
    setListing(true);
    try {
      const res = await getCaseEvidence(caseNo);
      setRecords(res.evidence);
    } catch {
      errorToast("Unable to load case evidence");
    } finally {
      setListing(false);
    }
  };

  const handleVerify = async (evidenceId: string, selected?: File | null) => {
    if (!selected) {
      errorToast("Select a file to verify against the chain");
      return;
    }
    try {
      const result = await verifyEvidence(evidenceId, selected);
      setVerdicts((v) => ({ ...v, [evidenceId]: result }));
      if (result.verified) successToast("Evidence VERIFIED — not tampered");
      else errorToast(`Verification failed: ${result.message}`);
    } catch {
      errorToast("Verification request failed");
    }
  };

  const handleCourt = async (evidenceId: string) => {
    try {
      await markCourtAdmissible(evidenceId);
      successToast("Evidence marked court-admissible");
      loadCaseEvidence(caseNumber);
    } catch {
      errorToast("Only senior officers may mark court-admissible");
    }
  };

  return (
    <div className="glass rounded-2xl p-5">
      <div className="mb-4 flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-accent-cyan" />
        <h3 className="text-sm font-semibold">Evidence Integrity</h3>
      </div>

      {/* Upload form */}
      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <input
          value={criminalId}
          onChange={(e) => setCriminalId(e.target.value)}
          placeholder="Criminal ID"
          className="rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-blue focus:outline-none"
        />
        <input
          value={caseNumber}
          onChange={(e) => setCaseNumber(e.target.value)}
          placeholder="Case number (e.g. OP-MUM-01)"
          className="rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-blue focus:outline-none"
        />
        <select
          value={evidenceType}
          onChange={(e) => setEvidenceType(e.target.value)}
          className="rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:border-accent-blue focus:outline-none"
        >
          {["DIGITAL", "DOCUMENT", "PHOTO", "VIDEO", "AUDIO", "FORENSIC"].map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          className="flex-1 rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-blue focus:outline-none"
        />
        <input
          ref={fileInput}
          type="file"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <button
          onClick={() => fileInput.current?.click()}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-text-secondary transition hover:bg-bg-hover"
        >
          <UploadCloud className="h-4 w-4" /> {file ? file.name : "Choose file"}
        </button>
        <button
          onClick={handleUpload}
          disabled={uploading || !file}
          className="rounded-lg bg-accent-blue px-4 py-2 text-sm font-semibold text-white transition hover:bg-seal-dark disabled:opacity-50"
        >
          {uploading ? "Securing…" : "Upload to chain"}
        </button>
      </div>

      {/* Case evidence list */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-text-muted">Case evidence on-chain</span>
        <button
          onClick={() => caseNumber && loadCaseEvidence(caseNumber)}
          disabled={!caseNumber || listing}
          className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs text-text-secondary transition hover:bg-bg-hover disabled:opacity-50"
        >
          <Search className="h-3.5 w-3.5" /> {listing ? "Loading…" : "Load"}
        </button>
      </div>

      <ul className="mt-2 space-y-2">
        {records.length === 0 ? (
          <li className="rounded-lg bg-bg-tertiary/50 p-3 text-center text-xs text-text-muted">
            No evidence loaded — enter a case number and load.
          </li>
        ) : (
          records.map((r) => {
            const verdict = verdicts[r.evidenceId];
            return (
              <li key={r.evidenceId} className="rounded-lg border border-border bg-bg-tertiary/60 p-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-mono text-xs text-text-secondary">{r.evidenceId}</span>
                  <span className="text-xs text-text-muted">{r.evidenceType}</span>
                  {r.courtAdmissible && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-risk-low/40 bg-risk-low/10 px-2 py-0.5 text-[10px] text-risk-low">
                      <Scale className="h-3 w-3" /> Court-admissible
                    </span>
                  )}
                  {verdict && (
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        verdict.verified
                          ? "bg-risk-low/10 text-risk-low"
                          : "bg-risk-critical/10 text-risk-critical"
                      }`}
                    >
                      {verdict.verified ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                      {verdict.integrity}
                    </span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-text-muted">
                  <span>SHA-256: {r.fileHash.slice(0, 18)}…</span>
                  <span>·</span>
                  <span>IPFS: {r.ipfsHash.slice(0, 12)}…</span>
                  <span>·</span>
                  <span>{r.formattedTimestamp ?? "—"}</span>
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => {
                      const input = document.createElement("input");
                      input.type = "file";
                      input.onchange = () => handleVerify(r.evidenceId, input.files?.[0] ?? null);
                      input.click();
                    }}
                    className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs text-text-secondary transition hover:bg-bg-hover"
                  >
                    <FileSearch className="h-3.5 w-3.5" /> Verify file
                  </button>
                  {!r.courtAdmissible && (
                    <button
                      onClick={() => handleCourt(r.evidenceId)}
                      className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs text-text-secondary transition hover:bg-bg-hover"
                    >
                      <Scale className="h-3.5 w-3.5" /> Mark court-admissible
                    </button>
                  )}
                </div>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
