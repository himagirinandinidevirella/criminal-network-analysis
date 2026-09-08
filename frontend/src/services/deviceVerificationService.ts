/** A local, self-enrolled passkey demo. No server authentication/identity claim is made. */
import { IS_DEMO } from "@/config/runtime";
import type {
  DeviceCredential,
  DeviceVerificationContext,
} from "@/types/fingerprint.types";
import {
  base64url,
  bufferOf,
  createDeviceChallenge,
  fromBase64url,
  validateAuthenticatorData,
  validateClientData,
  verifyDeviceAssertion,
} from "@/utils/deviceVerification";

export interface DeviceSupport {
  supported: boolean;
  embedded: boolean;
  reason: string;
}
export function deviceContext(accountId: string): DeviceVerificationContext {
  return {
    origin: window.location.origin,
    rpId: window.location.hostname,
    accountId,
  };
}
function storageKey(context: DeviceVerificationContext) {
  return `${IS_DEMO ? "crimenet:demo" : "crimenet:local-demo"}:device-credential:v1:${encodeURIComponent(context.origin)}:${encodeURIComponent(context.accountId)}`;
}
export function loadDeviceCredential(
  context: DeviceVerificationContext,
): DeviceCredential | null {
  const raw = localStorage.getItem(storageKey(context));
  if (!raw) return null;
  let record: DeviceCredential;
  try {
    record = JSON.parse(raw);
  } catch {
    throw new Error(
      "The local device registration is damaged. Forget it and register again.",
    );
  }
  if (
    !record ||
    record.version !== 1 ||
    record.algorithm !== "ES256" ||
    record.accountId !== context.accountId ||
    record.rpId !== context.rpId ||
    record.origin !== context.origin ||
    typeof record.credentialId !== "string" ||
    typeof record.publicKeySpki !== "string" ||
    typeof record.userHandle !== "string" ||
    !Number.isSafeInteger(record.signCount) ||
    record.signCount < 0 ||
    record.signCount > 0xffffffff ||
    typeof record.createdAt !== "string" ||
    !Number.isFinite(Date.parse(record.createdAt)) ||
    (record.lastVerifiedAt !== undefined &&
      (typeof record.lastVerifiedAt !== "string" ||
        !Number.isFinite(Date.parse(record.lastVerifiedAt))))
  )
    throw new Error(
      "The local device registration is invalid. Forget it and register again.",
    );
  const id = fromBase64url(record.credentialId),
    key = fromBase64url(record.publicKeySpki),
    handle = fromBase64url(record.userHandle);
  if (id.length > 1024 || key.length > 1024 || handle.length > 64)
    throw new Error(
      "The local device registration is invalid. Forget it and register again.",
    );
  // Do not propagate arbitrary cached fields such as biometric data or private keys.
  return {
    ...context,
    version: 1,
    algorithm: "ES256",
    credentialId: record.credentialId,
    publicKeySpki: record.publicKeySpki,
    userHandle: record.userHandle,
    signCount: record.signCount,
    createdAt: record.createdAt,
    ...(record.lastVerifiedAt ? { lastVerifiedAt: record.lastVerifiedAt } : {}),
  };
}
export function forgetDeviceCredential(context: DeviceVerificationContext) {
  localStorage.removeItem(storageKey(context));
}
function saveDeviceCredential(record: DeviceCredential) {
  try {
    localStorage.setItem(storageKey(record), JSON.stringify(record));
  } catch {
    throw new Error(
      "Browser storage is unavailable. The local device record could not be saved.",
    );
  }
}
export async function deviceSupport(): Promise<DeviceSupport> {
  const embedded = window.self !== window.top;
  if (!window.isSecureContext)
    return {
      supported: false,
      embedded,
      reason: "Device verification requires HTTPS or localhost.",
    };
  if (!window.PublicKeyCredential || !navigator.credentials || !crypto.subtle)
    return {
      supported: false,
      embedded,
      reason: "This browser does not support WebAuthn device verification.",
    };
  if (embedded)
    return {
      supported: false,
      embedded: true,
      reason:
        "For device verification, open this page in a new tab. This demo does not request credentials inside embedded previews.",
    };
  try {
    const available =
      await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    return {
      supported: available,
      embedded,
      reason: available
        ? "A user-verifying device authenticator is available."
        : "No platform authenticator is available. Configure a fingerprint, Face ID or device PIN/passkey on a supported device.",
    };
  } catch {
    return {
      supported: false,
      embedded,
      reason:
        "The browser could not check device support. Try opening the page in a new tab.",
    };
  }
}
function cancelled(signal: AbortSignal) {
  if (signal.aborted)
    throw new DOMException("Device verification cancelled", "AbortError");
}
function requireTopLevel() {
  if (!window.isSecureContext || window.self !== window.top)
    throw new Error(
      "Open device verification in a top-level HTTPS tab or on localhost.",
    );
}

export async function registerDevice(
  context: DeviceVerificationContext,
  username: string,
  signal: AbortSignal,
): Promise<DeviceCredential> {
  requireTopLevel();
  cancelled(signal);
  if (loadDeviceCredential(context))
    throw new Error(
      "A device is already registered here. Verify it or explicitly forget the local registration first.",
    );
  const challenge = createDeviceChallenge(context);
  const userHandle = crypto.getRandomValues(new Uint8Array(32));
  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge: bufferOf(fromBase64url(challenge.challenge)),
      rp: { id: context.rpId, name: "CrimeNet local verification demo" },
      user: {
        id: bufferOf(userHandle),
        name: username.slice(0, 100),
        displayName: username.slice(0, 100),
      },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }],
      timeout: 60000,
      attestation: "none",
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "preferred",
      },
    },
    signal,
  })) as PublicKeyCredential | null;
  cancelled(signal);
  if (!credential || credential.type !== "public-key")
    throw new Error("The device did not return a credential.");
  const response = credential.response as AuthenticatorAttestationResponse;
  if (
    typeof response.getPublicKey !== "function" ||
    typeof response.getAuthenticatorData !== "function" ||
    typeof response.getPublicKeyAlgorithm !== "function" ||
    response.getPublicKeyAlgorithm() !== -7
  )
    throw new Error(
      "This browser cannot export the required ES256 public key. Try a current browser.",
    );
  const publicKey = response.getPublicKey();
  if (!publicKey) throw new Error("The device returned no public key.");
  validateClientData(response.clientDataJSON, challenge, "webauthn.create");
  const { signCount } = await validateAuthenticatorData(
    response.getAuthenticatorData(),
    context.rpId,
  );
  // Import validates the declared algorithm/curve before persisting anything.
  await crypto.subtle.importKey(
    "spki",
    publicKey,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"],
  );
  cancelled(signal);
  if (loadDeviceCredential(context))
    throw new Error(
      "Another registration completed while this prompt was open. The existing local record was not overwritten.",
    );
  const record: DeviceCredential = {
    ...context,
    version: 1,
    credentialId: base64url(new Uint8Array(credential.rawId)),
    publicKeySpki: base64url(new Uint8Array(publicKey)),
    userHandle: base64url(userHandle),
    algorithm: "ES256",
    signCount,
    createdAt: new Date().toISOString(),
  };
  saveDeviceCredential(record);
  return record;
}

export async function verifyRegisteredDevice(
  context: DeviceVerificationContext,
  signal: AbortSignal,
): Promise<DeviceCredential> {
  requireTopLevel();
  cancelled(signal);
  const record = loadDeviceCredential(context);
  if (!record)
    throw new Error("Register a device for this account and website first.");
  const challenge = createDeviceChallenge(context);
  const credential = (await navigator.credentials.get({
    publicKey: {
      challenge: bufferOf(fromBase64url(challenge.challenge)),
      rpId: context.rpId,
      allowCredentials: [
        {
          type: "public-key",
          id: bufferOf(fromBase64url(record.credentialId)),
          transports: ["internal"],
        },
      ],
      userVerification: "required",
      timeout: 60000,
    },
    signal,
  })) as PublicKeyCredential | null;
  cancelled(signal);
  if (!credential || credential.type !== "public-key")
    throw new Error("The device returned no verification response.");
  const response = credential.response as AuthenticatorAssertionResponse;
  const signCount = await verifyDeviceAssertion(
    record,
    {
      credentialId: base64url(new Uint8Array(credential.rawId)),
      clientDataJSON: response.clientDataJSON,
      authenticatorData: response.authenticatorData,
      signature: response.signature,
      userHandle: response.userHandle,
    },
    challenge,
  );
  cancelled(signal);
  // Another tab must not replace enrollment/counter state while this prompt is open.
  const current = loadDeviceCredential(context);
  if (
    !current ||
    current.credentialId !== record.credentialId ||
    current.signCount !== record.signCount ||
    current.publicKeySpki !== record.publicKeySpki ||
    current.userHandle !== record.userHandle
  )
    throw new Error(
      "The local device registration changed. Start verification again.",
    );
  const updated = {
    ...record,
    signCount,
    lastVerifiedAt: new Date().toISOString(),
  };
  saveDeviceCredential(updated);
  return updated;
}

export function deviceErrorMessage(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === "AbortError")
      return "Device operation cancelled. No verification result was saved.";
    if (error.name === "NotAllowedError")
      return "The device request was cancelled, timed out or denied. No identity was verified.";
    if (error.name === "SecurityError")
      return "Device verification was blocked for this origin. Open the project in a top-level HTTPS tab (or localhost).";
    if (error.name === "InvalidStateError")
      return "This device credential already exists or is unavailable. Use Verify registered device or manage passkeys in your device settings.";
  }
  return error instanceof Error ? error.message : "Device verification failed.";
}
