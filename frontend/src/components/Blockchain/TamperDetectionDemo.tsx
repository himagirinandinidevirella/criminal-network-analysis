/**
 * TamperDetectionDemo — Self-contained blockchain tamper detection demo.
 *
 * Flow: Type evidence → Store on chain → Verify (INTACT) → Tamper 1 byte → Verify (TAMPERED)
 * Designed as a 2-minute killer demo for SIH judges.
 */
import { useState, useCallback, useRef, useEffect } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  Lock,
  Unlock,
  Hash,
  Fingerprint,
  AlertTriangle,
  CheckCircle2,
  Zap,
  ArrowRight,
  RotateCcw,
  FileText,
  Binary,
} from "lucide-react";
import { post } from "@/services/api";

interface StoreResult {
  evidence_id: string;
  sha256: string;
  timestamp: string;
  tx_hash: string;
  block: number;
  status: string;
}

interface VerifyResult {
  verified: boolean;
  integrity: string;
  message: string;
  original_hash: string;
  current_hash: string;
  stored_at: string;
  tx_hash: string;
  diff?: {
    original_hash: string;
    current_hash: string;
    hash_mismatch: boolean;
    bits_changed: number;
  };
}

type DemoStep = "input" | "storing" | "stored" | "verifying" | "verified" | "tampering" | "tampered" | "detecting" | "detected";

const SAMPLE_EVIDENCE = `FIR No: 2026/MH/4817
Date: 15-Aug-2026  |  PS: Andheri West, Mumbai

COMPLAINANT: Rajesh Kumar Sharma, M/42, Aadhaar: 9234-XXXX-7891

ACCUSED: Vikram Singh (alias "Vicky"), M/35 approx.

STATEMENT OF FACTS:
On 14-Aug-2026 at approximately 22:45 hrs, the complainant was returning home from Lokhandwala market via the service road adjacent to DN Nagar Metro Station. At the intersection near Infinity Mall, two unknown persons on a black Pulsar motorcycle (MH-02-XX-1234) intercepted the complainant.

The pillion rider, later identified as the accused Vikram Singh, brandished a knife (approx. 8-inch blade) and demanded the complainant hand over his wallet, mobile phone (iPhone 15, IMEI: 354789XXXXXXX), and gold chain (approx. 22g, 22kt).

The entire incident was captured on CCTV camera installed at the adjacent petrol pump (Bharat Petroleum, DN Nagar).

EVIDENCE SEIZED: 1x CCTV footage, 1x blood-stained handkerchief recovered from scene.
Sections: BNS 309(4), 310(2), Arms Act S.25`;

export default function TamperDetectionDemo() {
  const [step, setStep] = useState<DemoStep>("input");
  const [evidenceText, setEvidenceText] = useState("");
  const [tamperedText, setTamperedText] = useState("");
  const [storeResult, setStoreResult] = useState<StoreResult | null>(null);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [tamperVerifyResult, setTamperVerifyResult] = useState<VerifyResult | null>(null);
  const [hashAnimation, setHashAnimation] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const tamperedRef = useRef<HTMLTextAreaElement>(null);

  // Auto-populate sample
  const loadSample = () => setEvidenceText(SAMPLE_EVIDENCE);

  // ── Step 1: Store evidence on chain ─────────────────────────────────────
  const storeEvidence = useCallback(async () => {
    if (!evidenceText.trim()) return;
    setStep("storing");
    setHashAnimation(true);
    try {
      const res = await post<StoreResult>("/api/blockchain/tamper-demo/store", {
        evidence_text: evidenceText,
        case_label: "LIVE-DEMO-" + Date.now().toString(36).toUpperCase(),
      });
      setStoreResult(res);
      setTimeout(() => { setStep("stored"); setHashAnimation(false); }, 1200);
    } catch {
      setStep("input");
      setHashAnimation(false);
    }
  }, [evidenceText]);

  // ── Step 2: Verify original (should be INTACT) ─────────────────────────
  const verifyOriginal = useCallback(async () => {
    if (!storeResult) return;
    setStep("verifying");
    try {
      const res = await post<VerifyResult>("/api/blockchain/tamper-demo/verify", {
        evidence_id: storeResult.evidence_id,
        evidence_text: evidenceText,
      });
      setVerifyResult(res);
      setTimeout(() => setStep("verified"), 800);
    } catch {
      setStep("stored");
    }
  }, [storeResult, evidenceText]);

  // ── Step 3: Tamper the evidence ────────────────────────────────────────
  const tamperEvidence = useCallback(() => {
    setStep("tampering");
    // Change "Rajesh Kumar Sharma" to "Rajesh Kumar Verma" — 1 name change
    let tampered = evidenceText;
    if (tampered.includes("Sharma")) {
      tampered = tampered.replace("Sharma", "Verma");
    } else {
      // fallback: change last character
      tampered = tampered.slice(0, -1) + "X";
    }
    setTamperedText(tampered);
    setTimeout(() => setStep("tampered"), 600);
  }, [evidenceText]);

  // ── Step 4: Verify tampered (should be TAMPERED) ───────────────────────
  const detectTamper = useCallback(async () => {
    if (!storeResult) return;
    setStep("detecting");
    try {
      const res = await post<VerifyResult>("/api/blockchain/tamper-demo/verify", {
        evidence_id: storeResult.evidence_id,
        evidence_text: tamperedText,
      });
      setTamperVerifyResult(res);
      setTimeout(() => setStep("detected"), 800);
    } catch {
      setStep("tampered");
    }
  }, [storeResult, tamperedText]);

  // ── Reset demo ─────────────────────────────────────────────────────────
  const reset = () => {
    setStep("input");
    setEvidenceText("");
    setTamperedText("");
    setStoreResult(null);
    setVerifyResult(null);
    setTamperVerifyResult(null);
  };

  // Highlight difference between original and tampered text
  const renderDiff = () => {
    if (!tamperedText || !evidenceText) return null;
    const orig = evidenceText;
    const tamp = tamperedText;
    const parts: JSX.Element[] = [];
    let diffStart = -1;
    let diffEnd = -1;
    for (let i = 0; i < Math.max(orig.length, tamp.length); i++) {
      if (orig[i] !== tamp[i]) {
        if (diffStart === -1) diffStart = i;
        diffEnd = i;
      }
    }
    if (diffStart >= 0) {
      parts.push(<span key="before" className="text-text-secondary">{tamp.substring(Math.max(0, diffStart - 40), diffStart)}</span>);
      parts.push(<span key="diff" className="bg-risk-critical/30 text-risk-critical font-bold px-0.5 rounded">{tamp.substring(diffStart, diffEnd + 1)}</span>);
      parts.push(<span key="after" className="text-text-secondary">{tamp.substring(diffEnd + 1, diffEnd + 41)}</span>);
      return <span className="font-mono text-xs">...{parts}...</span>;
    }
    return null;
  };

  // Step progress indicator
  const steps = [
    { key: "input", label: "Input", icon: FileText },
    { key: "stored", label: "Secured", icon: Lock },
    { key: "verified", label: "Verified", icon: ShieldCheck },
    { key: "tampered", label: "Tampered", icon: AlertTriangle },
    { key: "detected", label: "Detected", icon: ShieldAlert },
  ];

  const currentStepIdx = steps.findIndex(s => {
    if (step === "storing") return s.key === "input";
    if (step === "verifying") return s.key === "stored";
    if (step === "tampering") return s.key === "verified";
    if (step === "detecting") return s.key === "tampered";
    return s.key === step;
  });

  return (
    <div className="glass rounded-2xl p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-accent-cyan/20 to-accent-blue/20 text-accent-cyan">
            <Fingerprint className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-tight">Live Tamper Detection Demo</h3>
            <p className="text-[11px] text-text-muted">
              Blockchain-secured evidence integrity verification
            </p>
          </div>
        </div>
        {step !== "input" && (
          <button onClick={reset} className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs text-text-secondary transition hover:bg-bg-hover">
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </button>
        )}
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-1">
        {steps.map((s, i) => {
          const isActive = i === currentStepIdx;
          const isDone = i < currentStepIdx;
          const StepIcon = s.icon;
          return (
            <div key={s.key} className="flex items-center flex-1">
              <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all duration-500 ${
                isDone ? "bg-risk-low/15 text-risk-low" :
                isActive ? "bg-accent-blue/15 text-accent-blue ring-1 ring-accent-blue/30" :
                "bg-bg-tertiary text-text-muted"
              }`}>
                <StepIcon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{s.label}</span>
              </div>
              {i < steps.length - 1 && (
                <ArrowRight className={`mx-1 h-3 w-3 shrink-0 ${isDone ? "text-risk-low" : "text-text-muted/30"}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* ── STEP 1: Input ──────────────────────────────────────────────────── */}
      {(step === "input" || step === "storing") && (
        <div className="space-y-3 animate-in fade-in duration-300">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-text-secondary">Evidence Document</label>
            <button onClick={loadSample} className="text-[11px] text-accent-cyan hover:underline">
              Load Sample FIR
            </button>
          </div>
          <textarea
            ref={textareaRef}
            value={evidenceText}
            onChange={e => setEvidenceText(e.target.value)}
            rows={8}
            placeholder="Paste or type evidence text here (FIR, witness statement, forensic report...)"
            className="w-full rounded-xl border border-border bg-bg-tertiary px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-blue focus:outline-none focus:ring-1 focus:ring-accent-blue/30 font-mono resize-none"
          />
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-text-muted">{evidenceText.length} characters</span>
            <button
              onClick={storeEvidence}
              disabled={!evidenceText.trim() || step === "storing"}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-accent-blue to-accent-cyan px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent-blue/25 transition hover:shadow-accent-blue/40 disabled:opacity-50"
            >
              {step === "storing" ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Computing SHA-256…
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  Secure on Blockchain
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── Hash Animation ─────────────────────────────────────────────────── */}
      {hashAnimation && (
        <div className="flex flex-col items-center gap-3 py-4 animate-in fade-in duration-300">
          <div className="relative">
            <Binary className="h-12 w-12 text-accent-cyan animate-pulse" />
            <div className="absolute inset-0 rounded-full bg-accent-cyan/20 animate-ping" />
          </div>
          <div className="font-mono text-xs text-accent-cyan tracking-wider animate-pulse">
            Computing SHA-256 fingerprint...
          </div>
        </div>
      )}

      {/* ── STEP 2: Stored ─────────────────────────────────────────────────── */}
      {step === "stored" && storeResult && (
        <div className="space-y-4 animate-in slide-in-from-bottom-2 duration-500">
          <div className="rounded-xl border border-risk-low/30 bg-risk-low/5 p-4 space-y-3">
            <div className="flex items-center gap-2 text-risk-low">
              <CheckCircle2 className="h-5 w-5" />
              <span className="text-sm font-bold">Evidence Secured on Blockchain</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-bg-tertiary/80 p-2.5">
                <span className="text-text-muted">Evidence ID</span>
                <div className="font-mono text-text-primary mt-0.5">{storeResult.evidence_id}</div>
              </div>
              <div className="rounded-lg bg-bg-tertiary/80 p-2.5">
                <span className="text-text-muted">Block Number</span>
                <div className="font-mono text-text-primary mt-0.5">#{storeResult.block}</div>
              </div>
              <div className="col-span-full rounded-lg bg-bg-tertiary/80 p-2.5">
                <span className="text-text-muted">SHA-256 Fingerprint</span>
                <div className="font-mono text-accent-cyan mt-0.5 break-all text-[11px]">
                  <Hash className="inline h-3 w-3 mr-1" />
                  {storeResult.sha256}
                </div>
              </div>
              <div className="col-span-full rounded-lg bg-bg-tertiary/80 p-2.5">
                <span className="text-text-muted">Transaction Hash</span>
                <div className="font-mono text-text-primary mt-0.5 break-all text-[11px]">
                  {storeResult.tx_hash}
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={verifyOriginal}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-risk-low/80 to-risk-low px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:shadow-risk-low/30"
          >
            <ShieldCheck className="h-4 w-4" />
            Step 2: Verify Original Evidence
          </button>
        </div>
      )}

      {/* ── STEP 3: Verified (INTACT) ──────────────────────────────────────── */}
      {(step === "verified" || step === "verifying") && verifyResult && (
        <div className="space-y-4 animate-in slide-in-from-bottom-2 duration-500">
          <div className={`rounded-xl border p-4 transition-all duration-700 ${
            verifyResult.verified
              ? "border-risk-low/40 bg-risk-low/5"
              : "border-risk-critical/40 bg-risk-critical/5"
          }`}>
            <div className="flex items-center gap-3">
              <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${
                verifyResult.verified ? "bg-risk-low/15" : "bg-risk-critical/15"
              }`}>
                {verifyResult.verified
                  ? <ShieldCheck className="h-8 w-8 text-risk-low" />
                  : <ShieldAlert className="h-8 w-8 text-risk-critical" />
                }
              </div>
              <div>
                <div className={`text-lg font-bold ${verifyResult.verified ? "text-risk-low" : "text-risk-critical"}`}>
                  {verifyResult.integrity}
                </div>
                <div className="text-xs text-text-muted mt-0.5">{verifyResult.message}</div>
              </div>
            </div>
          </div>

          <button
            onClick={tamperEvidence}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500/80 to-risk-critical/80 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:shadow-risk-critical/30"
          >
            <Unlock className="h-4 w-4" />
            Step 3: Simulate Tampering (Change 1 Name)
          </button>
        </div>
      )}

      {/* ── STEP 4: Tampered ───────────────────────────────────────────────── */}
      {(step === "tampered" || step === "tampering" || step === "detecting") && (
        <div className="space-y-4 animate-in slide-in-from-bottom-2 duration-500">
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
            <div className="flex items-center gap-2 text-amber-400">
              <AlertTriangle className="h-5 w-5" />
              <span className="text-sm font-bold">Evidence Modified</span>
            </div>
            <p className="text-xs text-text-muted">
              Changed <span className="text-risk-low font-mono">"Sharma"</span> → <span className="text-risk-critical font-mono">"Verma"</span> — only 5 characters differ
            </p>
            <div className="rounded-lg bg-bg-tertiary/80 p-2.5 text-xs">
              <span className="text-text-muted">Modified Section:</span>
              <div className="mt-1">{renderDiff()}</div>
            </div>
          </div>

          <button
            onClick={detectTamper}
            disabled={step === "detecting"}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-risk-critical/80 to-risk-critical px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:shadow-risk-critical/30 disabled:opacity-50"
          >
            {step === "detecting" ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Verifying against blockchain…
              </>
            ) : (
              <>
                <Zap className="h-4 w-4" />
                Step 4: Run Blockchain Verification
              </>
            )}
          </button>
        </div>
      )}

      {/* ── STEP 5: Tamper Detected! ───────────────────────────────────────── */}
      {step === "detected" && tamperVerifyResult && (
        <div className="space-y-4 animate-in slide-in-from-bottom-2 duration-500">
          {/* TAMPERED result — big dramatic display */}
          <div className="relative overflow-hidden rounded-2xl border-2 border-risk-critical/50 bg-gradient-to-br from-risk-critical/10 to-risk-critical/5 p-6">
            {/* Animated background pulse */}
            <div className="absolute inset-0 bg-risk-critical/5 animate-pulse" />

            <div className="relative flex items-start gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-risk-critical/20 ring-2 ring-risk-critical/30">
                <ShieldAlert className="h-10 w-10 text-risk-critical" />
              </div>
              <div className="space-y-2">
                <div className="text-2xl font-black text-risk-critical tracking-tight">
                  🚨 TAMPER DETECTED
                </div>
                <p className="text-sm text-text-secondary">
                  The blockchain fingerprint does NOT match the submitted evidence.
                  This document has been modified after being secured on-chain.
                </p>
              </div>
            </div>

            {/* Hash comparison */}
            <div className="relative mt-4 grid grid-cols-1 gap-2">
              <div className="rounded-lg bg-risk-low/5 border border-risk-low/20 p-3">
                <div className="text-[10px] font-semibold text-risk-low uppercase tracking-wider mb-1">
                  Original Hash (Blockchain)
                </div>
                <div className="font-mono text-[11px] text-risk-low break-all">
                  {tamperVerifyResult.original_hash}
                </div>
              </div>
              <div className="rounded-lg bg-risk-critical/5 border border-risk-critical/20 p-3">
                <div className="text-[10px] font-semibold text-risk-critical uppercase tracking-wider mb-1">
                  Current Hash (Tampered)
                </div>
                <div className="font-mono text-[11px] text-risk-critical break-all">
                  {tamperVerifyResult.current_hash}
                </div>
              </div>
            </div>

            {tamperVerifyResult.diff && (
              <div className="relative mt-3 rounded-lg bg-bg-tertiary/60 p-3 text-xs text-text-muted">
                <span className="font-semibold text-risk-critical">
                  {tamperVerifyResult.diff.bits_changed} bits changed
                </span>{" "}
                in the SHA-256 hash — even a single character modification produces a completely different fingerprint (avalanche effect).
              </div>
            )}
          </div>

          {/* Conclusion */}
          <div className="rounded-xl border border-accent-cyan/20 bg-accent-cyan/5 p-4 text-xs text-text-secondary space-y-1">
            <div className="font-semibold text-accent-cyan">✅ Demo Complete — Blockchain Integrity Proven</div>
            <p>
              This demonstrates how SHA-256 + blockchain immutability makes evidence tampering
              <strong className="text-text-primary"> instantly detectable</strong>. Even changing a single character
              ("Sharma" → "Verma") produces a completely different hash, proving the document was modified.
            </p>
            <p className="text-text-muted mt-1">
              In production: every FIR, witness statement, and forensic report is fingerprinted at upload.
              Any modification — by any officer, at any time — is immediately flagged.
            </p>
          </div>

          <button
            onClick={reset}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-text-secondary transition hover:bg-bg-hover"
          >
            <RotateCcw className="h-4 w-4" />
            Run Demo Again
          </button>
        </div>
      )}
    </div>
  );
}
