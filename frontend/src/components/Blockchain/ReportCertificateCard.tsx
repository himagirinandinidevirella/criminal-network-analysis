/**
 * ReportCertificateCard — register report fingerprints on-chain and verify
 * report authenticity against their immutable certificate.
 */
import { useState } from "react";
import { FileBadge, FileCheck2, ShieldCheck, ShieldOff } from "lucide-react";
import {
  registerReport, verifyReport, getReportCertificate,
} from "@/services/blockchainService";
import { successToast, errorToast } from "@/components/Common/ToastNotification";
import type { ReportCertificate, ReportVerification } from "@/types/blockchain.types";

export default function ReportCertificateCard() {
  const [reportType, setReportType] = useState("criminal");
  const [entityId, setEntityId] = useState("");
  const [classification, setClassification] = useState("CONFIDENTIAL");
  const [content, setContent] = useState("");
  const [lastId, setLastId] = useState("");
  const [certificate, setCertificate] = useState<ReportCertificate | null>(null);
  const [verification, setVerification] = useState<ReportVerification | null>(null);
  const [verifyContent, setVerifyContent] = useState("");
  const [busy, setBusy] = useState(false);

  const register = async () => {
    if (!entityId) {
      errorToast("Provide an entity id");
      return;
    }
    setBusy(true);
    try {
      const res = await registerReport({
        report_type: reportType,
        entity_id: entityId,
        classification,
        content,
      });
      setLastId(res.report_id);
      setCertificate(res.certificate);
      successToast("Report certificate registered on-chain");
    } catch {
      errorToast("Report registration failed");
    } finally {
      setBusy(false);
    }
  };

  const verify = async (id?: string) => {
    const target = id ?? lastId;
    if (!target) {
      errorToast("Register a report or provide a report id");
      return;
    }
    setBusy(true);
    try {
      const res = await verifyReport(target, verifyContent || undefined);
      setVerification(res);
      if (res.authentic) successToast("Report AUTHENTIC — certificate matches");
      else errorToast("Report FAILED verification");
    } catch {
      errorToast("Verification failed");
    } finally {
      setBusy(false);
    }
  };

  const fetchCert = async () => {
    if (!lastId) return;
    try {
      setCertificate(await getReportCertificate(lastId));
    } catch {
      errorToast("Certificate not found");
    }
  };

  return (
    <div className="glass rounded-2xl p-5">
      <div className="mb-4 flex items-center gap-2">
        <FileBadge className="h-5 w-5 text-accent-cyan" />
        <h3 className="text-sm font-semibold">Report Certificates</h3>
      </div>

      <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <select
          value={reportType}
          onChange={(e) => setReportType(e.target.value)}
          className="rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:border-accent-blue focus:outline-none"
        >
          {["criminal", "case", "network", "executive"].map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <input
          value={entityId}
          onChange={(e) => setEntityId(e.target.value)}
          placeholder="Entity ID"
          className="rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-blue focus:outline-none"
        />
        <select
          value={classification}
          onChange={(e) => setClassification(e.target.value)}
          className="rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:border-accent-blue focus:outline-none"
        >
          {["CONFIDENTIAL", "SECRET", "TOP_SECRET", "PUBLIC"].map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Report content / JSON to fingerprint (hash-only if empty)"
        rows={3}
        className="mb-3 w-full rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-blue focus:outline-none"
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={register}
          disabled={busy || !entityId}
          className="rounded-lg bg-accent-blue px-4 py-2 text-sm font-semibold text-white transition hover:bg-seal-dark disabled:opacity-50"
        >
          {busy ? "Working…" : "Register certificate"}
        </button>
        <input
          value={verifyContent}
          onChange={(e) => setVerifyContent(e.target.value)}
          placeholder="Content to verify against certificate"
          className="min-w-48 flex-1 rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-blue focus:outline-none"
        />
        <button
          onClick={() => verify()}
          disabled={busy || !lastId}
          className="flex items-center gap-1.5 rounded-lg border border-accent-cyan/40 bg-accent-cyan/10 px-3 py-2 text-sm text-accent-cyan transition hover:bg-accent-cyan/20 disabled:opacity-50"
        >
          <FileCheck2 className="h-4 w-4" /> Verify
        </button>
      </div>

      {certificate && (
        <div className="mb-3 rounded-xl border border-border bg-bg-tertiary/60 p-3 text-xs">
          <div className="mb-1 flex items-center justify-between">
            <span className="font-semibold text-text-primary">Certificate {certificate.report_id}</span>
            <button onClick={fetchCert} className="text-accent-cyan hover:underline">refresh</button>
          </div>
          <div className="font-mono text-[11px] text-text-muted">
            SHA-256 {certificate.report_hash.slice(0, 40)}…
          </div>
          <div className="mt-1 text-text-secondary">
            {certificate.classification} · {certificate.registered_at || "—"} · {certificate.network || "—"}
          </div>
        </div>
      )}

      {verification && (
        <div
          className={`flex items-center gap-3 rounded-xl border p-3 text-sm ${
            verification.authentic ? "border-risk-low/40 bg-risk-low/10" : "border-risk-critical/40 bg-risk-critical/10"
          }`}
        >
          {verification.authentic ? (
            <ShieldCheck className="h-6 w-6 text-risk-low" />
          ) : (
            <ShieldOff className="h-6 w-6 text-risk-critical" />
          )}
          <div>
            <div className={`font-bold ${verification.authentic ? "text-risk-low" : "text-risk-critical"}`}>
              {verification.authentic ? "AUTHENTIC — certificate matches" : "FAILED — report altered or revoked"}
            </div>
            <div className="text-xs text-text-muted">
              Generated by {verification.generated_by || "—"} · Court valid: {verification.court_valid ? "YES" : "NO"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
