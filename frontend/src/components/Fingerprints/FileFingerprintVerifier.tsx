import { useEffect, useRef, useState } from "react";
import {
  CheckCircle,
  AlertTriangle,
  Copy,
  Download,
  FileCheck,
  Loader2,
} from "lucide-react";
import {
  FILE_FINGERPRINT_NOTICE,
  fingerprintFile,
  fingerprintResult,
  normalizeSHA256,
  validateFingerprintFile,
} from "@/utils/fileFingerprints";
import type { FileFingerprintResult } from "@/types/fingerprint.types";
import { downloadJSON } from "@/utils/exportUtils";
import {
  errorToast,
  successToast,
} from "@/components/Common/ToastNotification";

export default function FileFingerprintVerifier() {
  const [file, setFile] = useState<File | null>(null);
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [referenceType, setReferenceType] = useState<"hash" | "file">("hash");
  const [reference, setReference] = useState("");
  const [result, setResult] = useState<FileFingerprintResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const request = useRef(0);
  useEffect(
    () => () => {
      request.current++;
    },
    [],
  );
  const invalidate = () => {
    request.current++;
    setResult(null);
    setBusy(false);
    setError("");
  };
  const select = (value: File | null, target: "file" | "reference") => {
    invalidate();
    try {
      if (value) validateFingerprintFile(value);
      if (target === "file") setFile(value);
      else setReferenceFile(value);
    } catch (error) {
      if (target === "file") setFile(null);
      else setReferenceFile(null);
      setError((error as Error).message);
    }
  };
  const run = async (compare: boolean) => {
    if (!file || busy) return;
    const version = ++request.current;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      let expected: string | undefined;
      if (compare && referenceType === "file") {
        if (!referenceFile) throw new Error("Choose a reference file first.");
        expected = await fingerprintFile(referenceFile);
      } else if (compare) {
        const normalized = normalizeSHA256(reference);
        if (!normalized)
          throw new Error("Enter a valid 64-character SHA-256 reference.");
        expected = normalized;
      }
      const sha256 = await fingerprintFile(file);
      if (version === request.current)
        setResult(fingerprintResult(file, sha256, expected));
    } catch (error) {
      if (version === request.current)
        setError(
          error instanceof Error
            ? error.message
            : "Could not calculate the file fingerprint.",
        );
    } finally {
      if (version === request.current) setBusy(false);
    }
  };
  const canCompare =
    file &&
    (referenceType === "hash" ? normalizeSHA256(reference) : referenceFile);
  return (
    <section
      aria-labelledby="file-fingerprint-heading"
      className="glass rounded-xl p-5 sm:p-6"
    >
      <h2
        id="file-fingerprint-heading"
        className="dossier-title flex items-center gap-2 text-xl font-semibold"
      >
        <FileCheck className="h-5 w-5 text-teal" />
        File fingerprint verification
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">
        Calculate a SHA-256 fingerprint, then compare it with a trusted
        reference hash or another file. A fingerprint scan image can be checked
        as a file here; its biometric content is not analysed.
      </p>
      <p className="mt-3 rounded-lg border border-teal/20 bg-teal-soft/60 p-3 text-xs leading-relaxed text-teal">
        {FILE_FINGERPRINT_NOTICE}
      </p>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div>
          <label
            htmlFor="fingerprint-file"
            className="mb-2 block text-xs font-semibold"
          >
            File to fingerprint
          </label>
          <input
            id="fingerprint-file"
            type="file"
            onChange={(event) =>
              select(event.target.files?.[0] ?? null, "file")
            }
            className="block w-full min-w-0 rounded-lg border border-paper-line bg-paper-sunk p-3 text-xs text-ink-soft file:mr-3 file:rounded file:border-0 file:bg-teal-soft file:px-3 file:py-2 file:text-teal"
          />
          <p className="mt-2 text-xs text-ink-soft">
            Any file type · maximum 25 MB · processed locally
          </p>
          {file && (
            <p className="mt-2 break-all text-xs text-ink-soft">
              Selected: {file.name} ({file.size.toLocaleString()} bytes)
            </p>
          )}
        </div>
        <fieldset className="min-w-0">
          <legend className="mb-2 text-xs font-semibold">
            Reference for comparison
          </legend>
          <div className="mb-3 flex flex-wrap gap-4 text-xs text-ink-soft">
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name="reference-type"
                checked={referenceType === "hash"}
                onChange={() => {
                  invalidate();
                  setReferenceType("hash");
                }}
                className="accent-teal"
              />
              Paste a SHA-256 hash
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name="reference-type"
                checked={referenceType === "file"}
                onChange={() => {
                  invalidate();
                  setReferenceType("file");
                }}
                className="accent-teal"
              />
              Compare another file
            </label>
          </div>
          {referenceType === "hash" ? (
            <>
              <label htmlFor="fingerprint-reference" className="sr-only">
                Reference SHA-256
              </label>
              <textarea
                id="fingerprint-reference"
                value={reference}
                onChange={(event) => {
                  invalidate();
                  setReference(event.target.value);
                }}
                spellCheck={false}
                rows={3}
                maxLength={256}
                placeholder="Paste the trusted 64-character SHA-256 hash…"
                className="w-full rounded-lg border border-paper-line bg-paper-sunk p-3 font-mono text-xs"
              />
              {reference.trim() && !normalizeSHA256(reference) && (
                <p className="mt-1 text-xs text-risk-critical">
                  A SHA-256 reference needs exactly 64 hexadecimal characters
                  (0–9, a–f).
                </p>
              )}
            </>
          ) : (
            <>
              <label htmlFor="fingerprint-reference-file" className="sr-only">
                Reference file
              </label>
              <input
                id="fingerprint-reference-file"
                type="file"
                onChange={(event) =>
                  select(event.target.files?.[0] ?? null, "reference")
                }
                className="block w-full min-w-0 rounded-lg border border-paper-line bg-paper-sunk p-3 text-xs text-ink-soft file:mr-3 file:rounded file:border-0 file:bg-teal-soft file:px-3 file:py-2 file:text-teal"
              />
              <p className="mt-2 text-xs text-ink-soft">
                Same bytes match, even if filenames differ. Similar-looking but
                changed files do not match.
              </p>
            </>
          )}
        </fieldset>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!file || busy}
          onClick={() => run(false)}
          className="inline-flex items-center gap-2 rounded-lg border border-paper-line px-4 py-2 text-sm font-semibold text-ink-soft hover:bg-paper-sunk disabled:opacity-50"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}Calculate
          SHA-256
        </button>
        <button
          type="button"
          disabled={!canCompare || busy}
          onClick={() => run(true)}
          className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-dark disabled:opacity-50"
        >
          Verify file integrity
        </button>
      </div>
      {busy && (
        <p role="status" className="mt-3 text-sm text-ink-soft">
          Calculating file fingerprint…
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="mt-3 rounded-lg bg-risk-critical/10 p-3 text-sm text-risk-critical"
        >
          {error}
        </p>
      )}
      {result && (
        <div className="mt-5 space-y-3 rounded-xl border border-paper-line bg-paper-sunk/50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
            Calculated SHA-256
          </p>
          <code
            data-testid="calculated-file-fingerprint"
            className="block break-all font-mono text-xs text-teal"
          >
            {result.sha256}
          </code>
          {result.matches !== null && (
            <p
              role="status"
              className={`flex items-start gap-2 rounded-lg p-3 text-sm font-semibold ${result.matches ? "bg-risk-low/10 text-risk-low" : "bg-risk-critical/10 text-risk-critical"}`}
            >
              {result.matches ? (
                <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              {result.matches
                ? "Fingerprint matches the supplied reference."
                : "Fingerprint mismatch — the file differs from the supplied reference."}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(result.sha256);
                  successToast("SHA-256 copied");
                } catch {
                  errorToast(
                    "Clipboard unavailable. Select and copy the displayed hash manually.",
                  );
                }
              }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal"
            >
              <Copy className="h-3.5 w-3.5" />
              Copy fingerprint
            </button>
            <button
              type="button"
              onClick={() =>
                downloadJSON("file-fingerprint-check.json", {
                  algorithm: "SHA-256",
                  notice: FILE_FINGERPRINT_NOTICE,
                  ...result,
                })
              }
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft"
            >
              <Download className="h-3.5 w-3.5" />
              Download checksum record
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
