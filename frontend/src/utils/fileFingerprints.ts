import type { FileFingerprintResult } from "@/types/fingerprint.types";

export const MAX_FINGERPRINT_FILE_BYTES = 25 * 1024 * 1024;
export const FILE_FINGERPRINT_NOTICE =
  "SHA-256 file-integrity comparison only. A matching checksum does not identify a person or prove authorship, provenance, consent, or legal admissibility. No file contents are stored or uploaded.";
export function normalizeSHA256(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  return /^[a-f0-9]{64}$/.test(normalized) ? normalized : null;
}
export function validateFingerprintFile(file: Pick<File, "size">): void {
  if (file.size > MAX_FINGERPRINT_FILE_BYTES)
    throw new Error("Choose a file of 25 MB or less.");
}
export async function fingerprintFile(file: File): Promise<string> {
  validateFingerprintFile(file);
  if (!globalThis.crypto?.subtle)
    throw new Error("File fingerprinting requires HTTPS or local development.");
  const hash = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
export function fingerprintResult(
  file: File,
  sha256: string,
  reference?: string,
): FileFingerprintResult {
  const normalized =
    reference === undefined ? null : normalizeSHA256(reference);
  if (reference !== undefined && !normalized)
    throw new Error(
      "A SHA-256 reference must contain exactly 64 hexadecimal characters.",
    );
  return {
    file_name: file.name,
    size_bytes: file.size,
    sha256,
    reference_sha256: normalized,
    matches: normalized ? normalized === sha256 : null,
    calculated_at: new Date().toISOString(),
  };
}
