import { Link } from "react-router-dom";
import { useState } from "react";
import { Fingerprint, CheckCircle, AlertTriangle } from "lucide-react";
import { sha256 } from "@/demo/store";
import DemoWorkspacePanel from "./DemoWorkspacePanel";

const SAMPLE =
  "SYNTHETIC DEMO | Case DEMO/2026/001 | Sample transfer: INR 4500000 | Status: under review";
export default function DemoIntegrity() {
  const [text, setText] = useState(SAMPLE);
  const [baseline, setBaseline] = useState("");
  const [comparison, setComparison] = useState<{
    hash: string;
    matches: boolean;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const calculate = async (save: boolean) => {
    setBusy(true);
    setError("");
    try {
      const hash = await sha256(text);
      if (save) {
        setBaseline(hash);
        setComparison(null);
      } else setComparison({ hash, matches: baseline === hash });
    } catch {
      setError(
        "Hashing requires a secure browser context (HTTPS or local development).",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <p className="font-mono text-xs uppercase tracking-wide text-teal">
          Browser cryptography
        </p>
        <h1 className="dossier-title mt-2 text-3xl font-bold">Integrity Lab</h1>
        <p className="mt-2 text-sm text-ink-soft">
          See how a checksum detects a change to a record.
        </p>
      </div>
      <div className="rounded-xl border border-seal-line bg-seal-soft p-4 text-sm text-seal">
        <strong>No blockchain is connected.</strong> SHA-256 is calculated
        locally using Web Crypto. A checksum can detect content changes against
        a trusted reference; it does not establish authorship, chain of custody
        or court admissibility.
      </div>
      <section className="glass rounded-xl p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Fingerprint className="h-5 w-5 text-teal" /> Try a tamper check
        </h2>
        <ol className="mt-3 list-inside list-decimal space-y-1 text-sm text-ink-soft">
          <li>Save a reference checksum.</li>
          <li>Edit the sample text, or use Change sample.</li>
          <li>Compare with the reference.</li>
        </ol>
        <label
          htmlFor="integrity-text"
          className="mt-5 block text-xs font-semibold"
        >
          Sample record
        </label>
        <textarea
          id="integrity-text"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setComparison(null);
          }}
          rows={5}
          maxLength={12000}
          className="mt-2 w-full rounded-lg border border-paper-line bg-paper-sunk p-3 font-mono text-sm"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            disabled={!text.trim() || busy}
            onClick={() => calculate(true)}
            className="rounded-lg bg-seal px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Save reference checksum
          </button>
          <button
            disabled={!baseline || busy}
            onClick={() => {
              setText((t) => `${t}\nChanged field: amount = 1`);
              setComparison(null);
            }}
            className="rounded-lg border border-paper-line px-4 py-2 text-sm disabled:opacity-50"
          >
            Change sample
          </button>
          <button
            disabled={!baseline || busy}
            onClick={() => calculate(false)}
            className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Compare checksum
          </button>
        </div>
        {baseline && (
          <div className="mt-4 rounded-lg bg-paper-sunk p-3">
            <p className="text-xs font-semibold">Reference SHA-256</p>
            <code className="mt-1 block break-all text-xs text-teal">
              {baseline}
            </code>
          </div>
        )}
        {comparison && (
          <div
            role="status"
            className={`mt-3 rounded-lg border p-4 ${comparison.matches ? "border-risk-low/30 bg-risk-low/10 text-risk-low" : "border-risk-critical/30 bg-risk-critical/10 text-risk-critical"}`}
          >
            <p className="flex items-center gap-2 font-semibold">
              {comparison.matches ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              {comparison.matches
                ? "Checksums match — text is unchanged"
                : "Checksum mismatch — text has changed"}
            </p>
            <code className="mt-2 block break-all text-xs">
              Current: {comparison.hash}
            </code>
          </div>
        )}
        {error && (
          <p role="alert" className="mt-3 text-sm text-risk-critical">
            {error}
          </p>
        )}
        <p className="mt-4 text-xs text-ink-soft">
          The reference above is temporary and resets when you leave this page.
          Registered file checksums below are saved locally.
        </p>
      </section>
      <Link
        to="/fingerprints"
        className="inline-block rounded-lg border border-teal/30 bg-teal-soft px-4 py-2 text-sm font-semibold text-teal"
      >
        Open file & device fingerprint verification →
      </Link>
      <DemoWorkspacePanel />
    </div>
  );
}
