import { describe, expect, it } from "vitest";
import {
  base64url,
  bufferOf,
  createDeviceChallenge,
  es256SignatureToRaw,
  fromBase64url,
  validateAuthenticatorData,
  validateClientData,
  verifyDeviceAssertion,
} from "@/utils/deviceVerification";
import type {
  DeviceAssertion,
  DeviceChallenge,
  DeviceCredential,
} from "@/types/fingerprint.types";

const context = {
  accountId: "demo-operator",
  origin: "https://verify.example.test",
  rpId: "verify.example.test",
};
function rawToDER(raw: Uint8Array): ArrayBuffer {
  const integer = (bytes: Uint8Array) => {
    let value = Array.from(bytes);
    while (value.length > 1 && value[0] === 0) value.shift();
    if (value[0] & 0x80) value = [0, ...value];
    return [2, value.length, ...value];
  };
  const body = [...integer(raw.slice(0, 32)), ...integer(raw.slice(32))];
  return Uint8Array.from([0x30, body.length, ...body]).buffer;
}
async function fixture(
  options: {
    flags?: number;
    count?: number;
    origin?: string;
    type?: string;
    crossOrigin?: boolean;
    rpId?: string;
    challenge?: DeviceChallenge;
  } = {},
) {
  const challenge = options.challenge ?? createDeviceChallenge(context);
  const keys = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const publicKey = await crypto.subtle.exportKey("spki", keys.publicKey);
  const record: DeviceCredential = {
    ...context,
    version: 1,
    credentialId: base64url(new Uint8Array([4, 7, 9])),
    publicKeySpki: base64url(new Uint8Array(publicKey)),
    userHandle: base64url(new Uint8Array([1, 2, 3])),
    algorithm: "ES256",
    signCount: 1,
    createdAt: new Date().toISOString(),
  };
  const clientDataJSON = bufferOf(
    new TextEncoder().encode(
      JSON.stringify({
        type: options.type ?? "webauthn.get",
        challenge: challenge.challenge,
        origin: options.origin ?? context.origin,
        crossOrigin: options.crossOrigin ?? false,
      }),
    ),
  );
  const authenticatorData = new Uint8Array(37);
  authenticatorData.set(
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(options.rpId ?? context.rpId),
      ),
    ),
  );
  authenticatorData[32] = options.flags ?? 0x05;
  new DataView(authenticatorData.buffer).setUint32(
    33,
    options.count ?? 2,
    false,
  );
  const message = new Uint8Array(69);
  message.set(authenticatorData);
  message.set(
    new Uint8Array(await crypto.subtle.digest("SHA-256", clientDataJSON)),
    37,
  );
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    keys.privateKey,
    message,
  );
  const assertion: DeviceAssertion = {
    credentialId: record.credentialId,
    clientDataJSON,
    authenticatorData: authenticatorData.buffer,
    signature: rawToDER(new Uint8Array(signature)),
    userHandle: bufferOf(fromBase64url(record.userHandle)),
  };
  return { record, assertion, challenge };
}

describe("local WebAuthn validation", () => {
  it("creates fresh, bounded challenges and canonical base64url encodings", () => {
    const one = createDeviceChallenge(context, 1000),
      two = createDeviceChallenge(context, 1000);
    expect(one.challenge).not.toBe(two.challenge);
    expect(fromBase64url(one.challenge)).toHaveLength(32);
    expect(one.expiresAt).toBe(61000);
    const bytes = new Uint8Array([0, 255, 128, 67, 99]);
    expect(fromBase64url(base64url(bytes))).toEqual(bytes);
    for (const bad of ["abc=", "*", "A", ""])
      expect(() => fromBase64url(bad)).toThrow();
  });
  it("accepts an actual valid ES256 signature with presence, user verification and account binding", async () => {
    const { record, assertion, challenge } = await fixture();
    await expect(
      verifyDeviceAssertion(record, assertion, challenge),
    ).resolves.toBe(2);
    await expect(
      verifyDeviceAssertion(
        record,
        { ...assertion, userHandle: null },
        challenge,
      ),
    ).resolves.toBe(2);
  });
  it("rejects changed challenges and expired requests (including replay into a new request)", async () => {
    const { record, assertion, challenge } = await fixture();
    await expect(
      verifyDeviceAssertion(record, assertion, createDeviceChallenge(context)),
    ).rejects.toThrow("challenge");
    await expect(
      verifyDeviceAssertion(record, assertion, challenge, challenge.expiresAt),
    ).rejects.toThrow("expired");
  });
  it("rejects foreign origins, RP IDs, ceremonies and embedded assertions", async () => {
    for (const options of [
      { origin: "https://evil.example.test" },
      { type: "webauthn.create" },
      { crossOrigin: true },
      { rpId: "evil.example.test" },
    ]) {
      const { record, assertion, challenge } = await fixture(options);
      await expect(
        verifyDeviceAssertion(record, assertion, challenge),
      ).rejects.toThrow();
    }
  });
  it("requires both user presence and user verification, not just a signed response", async () => {
    for (const flags of [0, 1, 4]) {
      const { record, assertion, challenge } = await fixture({ flags });
      await expect(
        verifyDeviceAssertion(record, assertion, challenge),
      ).rejects.toThrow("user presence and user verification");
    }
  });
  it("rejects wrong credentials, accounts and returned user handles", async () => {
    const { record, assertion, challenge } = await fixture();
    await expect(
      verifyDeviceAssertion(
        record,
        { ...assertion, credentialId: "another" },
        challenge,
      ),
    ).rejects.toThrow("different credential");
    await expect(
      verifyDeviceAssertion(
        { ...record, accountId: "another" },
        assertion,
        challenge,
      ),
    ).rejects.toThrow("account and origin");
    await expect(
      verifyDeviceAssertion(
        record,
        { ...assertion, userHandle: new Uint8Array([8, 9, 10]).buffer },
        challenge,
      ),
    ).rejects.toThrow("account handle");
  });
  it("checks nonzero counters while permitting zero-counter authenticators", async () => {
    const stale = await fixture({ count: 1 });
    await expect(
      verifyDeviceAssertion(stale.record, stale.assertion, stale.challenge),
    ).rejects.toThrow("counter");
    const zero = await fixture({ count: 0 });
    await expect(
      verifyDeviceAssertion(zero.record, zero.assertion, zero.challenge),
    ).resolves.toBe(0);
  });
  it("rejects a tampered signature and a wrong public key", async () => {
    const { record, assertion, challenge } = await fixture();
    const bytes = new Uint8Array(assertion.signature.slice(0));
    bytes[bytes.length - 1] ^= 1;
    await expect(
      verifyDeviceAssertion(
        record,
        { ...assertion, signature: bytes.buffer },
        challenge,
      ),
    ).rejects.toThrow("signature");
    const other = await fixture();
    await expect(
      verifyDeviceAssertion(
        { ...record, publicKeySpki: other.record.publicKeySpki },
        assertion,
        challenge,
      ),
    ).rejects.toThrow("signature");
  });
  it("rejects malformed data rather than accepting a fake verification", async () => {
    const challenge = createDeviceChallenge(context);
    for (const text of ["not-json", "null", "[]", "{}"])
      expect(() =>
        validateClientData(
          bufferOf(new TextEncoder().encode(text)),
          challenge,
          "webauthn.get",
        ),
      ).toThrow();
    await expect(
      validateAuthenticatorData(new ArrayBuffer(36), context.rpId),
    ).rejects.toThrow("authenticator data");
    for (const bytes of [
      [],
      [0x30, 2, 0, 0],
      Array.from({ length: 73 }, () => 0),
      [0x30, 6, 2, 1, 0x80, 2, 1, 1],
    ])
      expect(() =>
        es256SignatureToRaw(Uint8Array.from(bytes).buffer),
      ).toThrow();
    const valid = rawToDER(
      Uint8Array.from({ length: 64 }, (_, i) =>
        i === 0 || i === 32 ? 0x80 : 1,
      ),
    );
    expect(es256SignatureToRaw(valid)).toHaveLength(64);
  });
});
