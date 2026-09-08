/** Cryptographic/device records. No fingerprint images or biometric templates. */
export interface FileFingerprintResult {
  file_name: string;
  size_bytes: number;
  sha256: string;
  reference_sha256: string | null;
  matches: boolean | null;
  calculated_at: string;
}
export interface DeviceVerificationContext {
  origin: string;
  rpId: string;
  accountId: string;
}
export interface DeviceCredential extends DeviceVerificationContext {
  version: 1;
  credentialId: string;
  publicKeySpki: string;
  userHandle: string;
  algorithm: "ES256";
  signCount: number;
  createdAt: string;
  lastVerifiedAt?: string;
}
export interface DeviceChallenge extends DeviceVerificationContext {
  challenge: string;
  expiresAt: number;
}
export interface DeviceAssertion {
  credentialId: string;
  clientDataJSON: ArrayBuffer;
  authenticatorData: ArrayBuffer;
  signature: ArrayBuffer;
  userHandle: ArrayBuffer | null;
}
