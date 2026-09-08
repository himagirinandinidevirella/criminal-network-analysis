import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle,
  ExternalLink,
  Fingerprint,
  Key,
  Loader2,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import type { DeviceCredential } from "@/types/fingerprint.types";
import { DEVICE_VERIFICATION_NOTICE } from "@/utils/deviceVerification";
import {
  deviceContext,
  deviceErrorMessage,
  deviceSupport,
  forgetDeviceCredential,
  loadDeviceCredential,
  registerDevice,
  verifyRegisteredDevice,
  type DeviceSupport,
} from "@/services/deviceVerificationService";
import ConfirmModal from "@/components/Common/ConfirmModal";
import { formatDateTime } from "@/utils/formatters";

export default function DeviceFingerprintVerifier({
  accountId,
  displayName,
}: {
  accountId: string;
  displayName: string;
}) {
  const context = useMemo(() => deviceContext(accountId), [accountId]);
  const [support, setSupport] = useState<DeviceSupport | null>(null);
  const [record, setRecord] = useState<DeviceCredential | null>(null);
  const [invalidRecord, setInvalidRecord] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState<"register" | "verify" | null>(null);
  const [error, setError] = useState("");
  const [outcome, setOutcome] = useState<
    "registered" | "verified" | "forgotten" | null
  >(null);
  const [confirmForget, setConfirmForget] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const checkSupport = useCallback(async () => {
    const version = generation.current;
    setSupport(null);
    const value = await deviceSupport();
    if (version === generation.current) setSupport(value);
  }, []);
  useEffect(() => {
    checkSupport();
    try {
      setRecord(loadDeviceCredential(context));
      setInvalidRecord(false);
    } catch (error) {
      setInvalidRecord(true);
      setError(deviceErrorMessage(error));
    }
    return () => {
      generation.current++;
      controller.current?.abort();
    };
  }, [context, checkSupport]);
  const operate = async (action: "register" | "verify") => {
    if (!consent || busy || !support?.supported) return;
    const version = ++generation.current,
      abort = new AbortController();
    controller.current = abort;
    setBusy(action);
    setError("");
    setOutcome(null);
    try {
      const value =
        action === "register"
          ? await registerDevice(context, displayName, abort.signal)
          : await verifyRegisteredDevice(context, abort.signal);
      if (version === generation.current && !abort.signal.aborted) {
        setRecord(value);
        setInvalidRecord(false);
        setOutcome(action === "register" ? "registered" : "verified");
        setConsent(false);
      }
    } catch (error) {
      if (version === generation.current) setError(deviceErrorMessage(error));
    } finally {
      if (version === generation.current) {
        setBusy(null);
        controller.current = null;
      }
    }
  };
  return (
    <section
      aria-labelledby="device-fingerprint-heading"
      className="glass rounded-xl p-5 sm:p-6"
    >
      <h2
        id="device-fingerprint-heading"
        className="dossier-title flex items-center gap-2 text-xl font-semibold"
      >
        <Fingerprint className="h-5 w-5 text-teal" />
        Device biometric verification
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">
        Register a credential for this browser account, then ask your device to
        verify a fresh challenge. If configured, your device may use its
        fingerprint reader; it may instead use Face ID, a device PIN or another
        supported method.
      </p>
      <p className="mt-3 rounded-lg border border-seal-line bg-seal-soft p-3 text-xs leading-relaxed text-seal">
        {DEVICE_VERIFICATION_NOTICE}
      </p>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="rounded-xl border border-paper-line p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="h-4 w-4 text-teal" />
            Device support
          </h3>
          <p className="mt-3 text-sm text-ink-soft" role="status">
            {support?.reason ?? "Checking platform authenticator support…"}
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={checkSupport}
              className="text-xs font-semibold text-teal underline"
            >
              Check device support again
            </button>
            <a
              href="/fingerprints?tab=device"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold text-teal"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open biometric verification in a new tab
            </a>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-ink-soft">
            A compatible platform authenticator, HTTPS (or localhost) and a
            top-level tab are required. This page never asks you to type a
            device PIN or provide a fingerprint image.
          </p>
        </div>
        <div className="rounded-xl border border-paper-line p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Key className="h-4 w-4 text-teal" />
            Local registration
          </h3>
          <p className="mt-2 break-words text-sm text-ink-soft">
            Account: {displayName}
          </p>
          <p className="mt-1 break-all text-xs text-ink-soft">
            Website: {context.rpId}
          </p>
          {record ? (
            <dl className="mt-3 space-y-2 text-xs">
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="text-ink-soft">Registered</dt>
                <dd>{formatDateTime(record.createdAt)}</dd>
              </div>
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="text-ink-soft">Last local verification</dt>
                <dd>
                  {record.lastVerifiedAt
                    ? formatDateTime(record.lastVerifiedAt)
                    : "Not yet verified"}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-ink-soft">Public-key algorithm</dt>
                <dd>ES256 / P-256</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-3 text-sm text-ink-soft">
              {invalidRecord
                ? "Local registration needs to be cleared."
                : "No device registered for this account on this website."}
            </p>
          )}
          {(record || invalidRecord) && (
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={() => setConfirmForget(true)}
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-seal"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Forget local registration
            </button>
          )}
        </div>
      </div>
      <label className="mt-5 flex items-start gap-2 text-sm leading-relaxed text-ink-soft">
        <input
          type="checkbox"
          checked={consent}
          disabled={Boolean(busy)}
          onChange={(event) => setConsent(event.target.checked)}
          className="mt-1 accent-teal"
        />
        I consent to this device’s biometric or PIN verification prompt for this
        local demonstration.
      </label>
      <div className="mt-4 flex flex-wrap gap-2">
        {!record && !invalidRecord && (
          <button
            type="button"
            disabled={!support?.supported || !consent || Boolean(busy)}
            onClick={() => operate("register")}
            className="inline-flex items-center gap-2 rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-dark disabled:opacity-50"
          >
            <Fingerprint className="h-4 w-4" />
            Register this device
          </button>
        )}
        {record && (
          <button
            type="button"
            disabled={!support?.supported || !consent || Boolean(busy)}
            onClick={() => operate("verify")}
            className="inline-flex items-center gap-2 rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-dark disabled:opacity-50"
          >
            <ShieldCheck className="h-4 w-4" />
            Verify registered device
          </button>
        )}
        {busy && (
          <button
            type="button"
            onClick={() => controller.current?.abort()}
            className="rounded-lg border border-paper-line px-4 py-2 text-sm text-ink-soft"
          >
            Cancel device prompt
          </button>
        )}
      </div>
      {busy && (
        <p
          role="status"
          className="mt-3 flex items-center gap-2 text-sm text-teal"
        >
          <Loader2 className="h-4 w-4 animate-spin" />
          Waiting for your device’s{" "}
          {busy === "register" ? "registration" : "verification"} prompt…
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="mt-4 rounded-lg bg-risk-critical/10 p-3 text-sm text-risk-critical"
        >
          {error}
        </p>
      )}
      {outcome && (
        <div
          role="status"
          className="mt-4 rounded-lg border border-teal/25 bg-teal-soft p-4 text-sm text-teal"
        >
          <p className="flex items-center gap-2 font-semibold">
            <CheckCircle className="h-4 w-4" />
            {outcome === "verified"
              ? "Registered authenticator verified for this challenge."
              : outcome === "registered"
                ? "Device credential registered locally."
                : "Local device registration forgotten."}
          </p>
          <p className="mt-2 text-xs leading-relaxed">
            {outcome === "verified"
              ? "The signature, fresh challenge, website binding, user presence and user-verification flag passed. This does not prove a fingerprint was used or identify a person; no roles or access permissions were changed."
              : outcome === "registered"
                ? "Only a public key, credential reference and account/site metadata were saved. Now verify a fresh challenge to test possession of the registered credential."
                : "The passkey may still exist in your device or passkey provider. Manage or remove it in your device settings."}
          </p>
        </div>
      )}
      <p className="mt-5 border-t border-paper-line pt-4 text-xs leading-relaxed text-ink-soft">
        This demo validates the signed response locally. Local registration data
        can be edited or cleared by the browser owner, so this is not a
        production login, security gate or forensic identity check. Production
        WebAuthn must use a trusted server to issue and consume challenges, bind
        users, store public keys and verify responses. No hardware attestation
        is requested. Your authenticator/provider controls biometric storage and
        passkey sync.
      </p>
      <ConfirmModal
        open={confirmForget}
        title="Forget this local device registration?"
        message="The public-key reference for this account and website will be removed from this browser. This does not remove the passkey from your device and does not affect other app data."
        confirmLabel="Forget registration"
        danger
        onCancel={() => setConfirmForget(false)}
        onConfirm={() => {
          try {
            forgetDeviceCredential(context);
            setRecord(null);
            setInvalidRecord(false);
            setOutcome("forgotten");
            setError("");
            setConsent(false);
          } catch (error) {
            setError(deviceErrorMessage(error));
          }
          setConfirmForget(false);
        }}
      />
    </section>
  );
}
