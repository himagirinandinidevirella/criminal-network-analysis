import type {
  DeviceAssertion,
  DeviceChallenge,
  DeviceCredential,
  DeviceVerificationContext,
} from "@/types/fingerprint.types";

export const DEVICE_VERIFICATION_NOTICE =
  "Local WebAuthn demonstration, not production authentication or proof of a person's identity. The authenticator may use a fingerprint, face, device PIN or another approved method; the browser does not reveal which. No fingerprint scans, biometric templates or private keys are received by this app.";
export const DEVICE_CHALLENGE_TTL_MS = 60000;

export function base64url(bytes: Uint8Array): string {
  let raw = "";
  for (const byte of bytes) raw += String.fromCharCode(byte);
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function fromBase64url(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value) || value.length % 4 === 1)
    throw new Error("Invalid credential encoding");
  const raw = atob(
    value.replace(/-/g, "+").replace(/_/g, "/") +
      "=".repeat((4 - (value.length % 4)) % 4),
  );
  const bytes = Uint8Array.from(raw, (char) => char.charCodeAt(0));
  if (base64url(bytes) !== value)
    throw new Error("Non-canonical credential encoding");
  return bytes;
}
export function bufferOf(bytes: Uint8Array): ArrayBuffer {
  return Uint8Array.from(bytes).buffer;
}
function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}
export function createDeviceChallenge(
  context: DeviceVerificationContext,
  now = Date.now(),
): DeviceChallenge {
  return {
    ...context,
    challenge: base64url(crypto.getRandomValues(new Uint8Array(32))),
    expiresAt: now + DEVICE_CHALLENGE_TTL_MS,
  };
}
export function validateClientData(
  data: ArrayBuffer,
  expected: DeviceChallenge,
  type: "webauthn.create" | "webauthn.get",
  now = Date.now(),
): void {
  if (now >= expected.expiresAt)
    throw new Error("The device challenge expired. Start verification again.");
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(data));
  } catch {
    throw new Error("Invalid authenticator client data");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw new Error("Invalid authenticator client data");
  if (parsed.type !== type || parsed.challenge !== expected.challenge)
    throw new Error("The device response does not match this challenge.");
  if (parsed.origin !== expected.origin || parsed.crossOrigin === true)
    throw new Error(
      "The device response is from a different or embedded origin.",
    );
}
export async function validateAuthenticatorData(
  data: ArrayBuffer,
  rpId: string,
): Promise<{ signCount: number }> {
  const bytes = new Uint8Array(data);
  if (bytes.length < 37) throw new Error("Invalid authenticator data");
  const expectedHash = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rpId)),
  );
  if (!equalBytes(bytes.slice(0, 32), expectedHash))
    throw new Error("This credential belongs to a different website.");
  if ((bytes[32] & 0x01) === 0 || (bytes[32] & 0x04) === 0)
    throw new Error(
      "The authenticator did not confirm both user presence and user verification.",
    );
  return { signCount: new DataView(data).getUint32(33, false) };
}

/** WebAuthn ES256 signatures are DER encoded; Web Crypto expects fixed-width r || s. */
export function es256SignatureToRaw(signature: ArrayBuffer): Uint8Array {
  const bytes = new Uint8Array(signature);
  if (
    bytes.length < 8 ||
    bytes.length > 72 ||
    bytes[0] !== 0x30 ||
    bytes[1] !== bytes.length - 2
  )
    throw new Error("Invalid ES256 signature");
  let offset = 2;
  const integer = () => {
    if (bytes[offset++] !== 0x02)
      throw new Error("Invalid ES256 signature integer");
    const length = bytes[offset++];
    if (!length || length > 33 || offset + length > bytes.length)
      throw new Error("Invalid ES256 signature length");
    let value = bytes.slice(offset, offset + length);
    offset += length;
    if (value[0] & 0x80) throw new Error("Negative ES256 signature integer");
    if (value.length > 1 && value[0] === 0) {
      if (!(value[1] & 0x80)) throw new Error("Non-canonical ES256 signature");
      value = value.slice(1);
    }
    if (value.length > 32) throw new Error("Invalid ES256 signature size");
    const padded = new Uint8Array(32);
    padded.set(value, 32 - value.length);
    return padded;
  };
  const r = integer(),
    s = integer();
  if (offset !== bytes.length) throw new Error("Trailing signature data");
  const raw = new Uint8Array(64);
  raw.set(r);
  raw.set(s, 32);
  return raw;
}

/** Validates a response to a fresh, account-bound local challenge. Never grants application access. */
export async function verifyDeviceAssertion(
  record: DeviceCredential,
  assertion: DeviceAssertion,
  challenge: DeviceChallenge,
  now = Date.now(),
): Promise<number> {
  if (
    record.origin !== challenge.origin ||
    record.rpId !== challenge.rpId ||
    record.accountId !== challenge.accountId ||
    record.algorithm !== "ES256"
  )
    throw new Error(
      "The registered credential does not belong to this account and origin.",
    );
  if (assertion.credentialId !== record.credentialId)
    throw new Error("A different credential answered this challenge.");
  if (
    assertion.userHandle &&
    !equalBytes(
      new Uint8Array(assertion.userHandle),
      fromBase64url(record.userHandle),
    )
  )
    throw new Error("The authenticator returned a different account handle.");
  validateClientData(assertion.clientDataJSON, challenge, "webauthn.get", now);
  const { signCount } = await validateAuthenticatorData(
    assertion.authenticatorData,
    challenge.rpId,
  );
  if (record.signCount > 0 && signCount > 0 && signCount <= record.signCount)
    throw new Error(
      "The authenticator counter did not advance. This response cannot be accepted.",
    );
  const key = await crypto.subtle.importKey(
    "spki",
    bufferOf(fromBase64url(record.publicKeySpki)),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"],
  );
  const clientHash = new Uint8Array(
    await crypto.subtle.digest("SHA-256", assertion.clientDataJSON),
  );
  const data = new Uint8Array(
    assertion.authenticatorData.byteLength + clientHash.length,
  );
  data.set(new Uint8Array(assertion.authenticatorData));
  data.set(clientHash, assertion.authenticatorData.byteLength);
  const valid = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    bufferOf(es256SignatureToRaw(assertion.signature)),
    data,
  );
  if (!valid) throw new Error("The device signature is invalid.");
  return signCount;
}
