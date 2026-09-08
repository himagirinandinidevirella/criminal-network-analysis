import { beforeEach, expect, it } from "vitest";
import {
  forgetDeviceCredential,
  loadDeviceCredential,
} from "@/services/deviceVerificationService";
import { base64url } from "@/utils/deviceVerification";
const context = {
  origin: "https://device.example.test",
  rpId: "device.example.test",
  accountId: "demo-user",
};
const key = `crimenet:demo:device-credential:v1:${encodeURIComponent(context.origin)}:${encodeURIComponent(context.accountId)}`;
const record = () => ({
  ...context,
  version: 1,
  algorithm: "ES256",
  credentialId: base64url(new Uint8Array([1, 2, 3])),
  publicKeySpki: base64url(new Uint8Array([4, 5, 6])),
  userHandle: base64url(new Uint8Array([7, 8, 9])),
  signCount: 0,
  createdAt: new Date().toISOString(),
});
beforeEach(() => localStorage.removeItem(key));
it("whitelists public registration fields and isolates accounts/origins when reading or forgetting", () => {
  localStorage.setItem(
    key,
    JSON.stringify({
      ...record(),
      privateKey: "must not propagate",
      fingerprintTemplate: "must not propagate",
    }),
  );
  expect(loadDeviceCredential(context)).not.toHaveProperty("privateKey");
  expect(loadDeviceCredential(context)).not.toHaveProperty(
    "fingerprintTemplate",
  );
  expect(
    loadDeviceCredential({ ...context, accountId: "someone-else" }),
  ).toBeNull();
  expect(
    loadDeviceCredential({ ...context, origin: "https://other.example.test" }),
  ).toBeNull();
  localStorage.setItem("unrelated", "keep");
  forgetDeviceCredential(context);
  expect(loadDeviceCredential(context)).toBeNull();
  expect(localStorage.getItem("unrelated")).toBe("keep");
});
it("rejects corrupt keys, date/counter data and foreign bindings without deleting other data", () => {
  for (const raw of [
    "broken",
    JSON.stringify({ ...record(), signCount: -1 }),
    JSON.stringify({ ...record(), createdAt: "invalid date" }),
    JSON.stringify({ ...record(), lastVerifiedAt: "invalid date" }),
    JSON.stringify({ ...record(), rpId: "elsewhere.test" }),
    JSON.stringify({ ...record(), credentialId: "%%%" }),
  ]) {
    localStorage.setItem(key, raw);
    expect(() => loadDeviceCredential(context)).toThrow();
    expect(localStorage.getItem(key)).toBe(raw);
  }
});
