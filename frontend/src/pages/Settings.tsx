import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { Shield, User, Bell, Database, RotateCcw } from "lucide-react";
import { RootState } from "@/store";
import { get, post, clearSession } from "@/services/api";
import type { MeResponse } from "@/types/api.types";
import { IS_DEMO } from "@/config/runtime";
import {
  getAlertPreferences,
  saveAlertPreferences,
  enableBrowserNotifications,
} from "@/services/preferences";
import { alertSocket } from "@/services/websocket";
import {
  successToast,
  errorToast,
} from "@/components/Common/ToastNotification";
import ConfirmModal from "@/components/Common/ConfirmModal";

export default function Settings() {
  const user = useSelector((state: RootState) => state.auth.user);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  const [preferences, setPreferences] = useState(getAlertPreferences);
  const [reset, setReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  useEffect(() => {
    get<MeResponse>("/api/auth/me")
      .then(setMe)
      .catch(() => setError("Profile permissions are unavailable."));
    // get() already unwraps the API envelope.
    get<Record<string, unknown>>("/health")
      .then(setHealth)
      .catch(() => setError("Could not reach the system status endpoint."));
  }, []);
  const preference = (key: "toasts" | "sound", value: boolean) => {
    try {
      const next = { ...preferences, [key]: value };
      saveAlertPreferences(next);
      setPreferences(next);
    } catch {
      errorToast("Could not save notification preferences");
    }
  };
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Settings</h1>
      {error && (
        <p role="alert" className="text-sm text-risk-critical">
          {error}
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="glass rounded-2xl p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <User className="h-4 w-4 text-seal" />
            Profile
          </h2>
          <dl className="space-y-2 text-sm">
            {[
              ["Name", user?.name],
              ["Badge ID", user?.badge_id],
              ["Role", user?.role],
              ["Department", user?.department],
            ].map(([key, value]) => (
              <div
                key={key}
                className="flex justify-between gap-3 border-b border-paper-line pb-2"
              >
                <dt className="text-ink-soft">{key}</dt>
                <dd className="break-all text-right">{value ?? "—"}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section className="glass rounded-2xl p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Shield className="h-4 w-4 text-teal" />
            Permissions
          </h2>
          {IS_DEMO && (
            <p className="mb-3 text-xs text-teal">
              Demo roles illustrate the interface. Browser login and permissions
              are not a security boundary.
            </p>
          )}
          {me ? (
            <ul className="space-y-2 text-sm">
              {Object.entries(me.permissions).map(([key, value]) => (
                <li key={key} className="flex justify-between gap-2">
                  <span className="text-ink-soft">
                    {key.replace(/_/g, " ")}
                  </span>
                  <span className={value ? "text-teal" : "text-ink-faint"}>
                    {value ? "Available" : "Unavailable"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-ink-soft">
              {error ? "Unable to load permissions" : "Loading permissions…"}
            </p>
          )}
        </section>
        <section className="glass rounded-2xl p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Database className="h-4 w-4 text-teal" />
            System Status
          </h2>
          {health ? (
            <dl className="space-y-2 text-sm">
              {Object.entries(health).map(([key, value]) => (
                <div
                  key={key}
                  className="flex justify-between gap-3 border-b border-paper-line pb-2"
                >
                  <dt className="text-ink-soft">{key}</dt>
                  <dd className="break-words text-right">
                    {typeof value === "object"
                      ? JSON.stringify(value)
                      : String(value)}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-xs text-ink-soft">
              {error ? "Status unavailable" : "Checking system…"}
            </p>
          )}
        </section>
        <section className="glass rounded-2xl p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Bell className="h-4 w-4 text-risk-medium" />
            Notifications
          </h2>
          <label className="flex items-center gap-2 text-sm text-ink-soft">
            <input
              type="checkbox"
              className="accent-seal"
              checked={preferences.toasts}
              onChange={(e) => preference("toasts", e.target.checked)}
            />
            Show new-alert notifications
          </label>
          <label className="mt-3 flex items-center gap-2 text-sm text-ink-soft">
            <input
              type="checkbox"
              className="accent-seal"
              checked={preferences.sound}
              onChange={(e) => preference("sound", e.target.checked)}
            />
            Sound on critical / high alerts
          </label>
          <p className="mt-3 text-xs text-ink-soft">
            Preferences are saved in this browser. Audio may require a user
            interaction first.
          </p>
          <button
            onClick={async () => {
              try {
                const result = await enableBrowserNotifications();
                setPreferences(getAlertPreferences());
                if (result === "granted")
                  successToast("Browser notifications enabled");
                else
                  errorToast(
                    "Notifications were not enabled. Your browser may block permission requests here.",
                  );
              } catch {
                errorToast("Browser notifications are unavailable");
              }
            }}
            className="mt-4 rounded-lg border border-paper-line px-3 py-2 text-xs text-ink-soft"
          >
            Enable browser notifications
          </button>
        </section>
      </div>
      {IS_DEMO && (
        <section className="glass rounded-2xl p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <RotateCcw className="h-4 w-4 text-seal" />
            Reset demo workspace
          </h2>
          <p className="mt-2 text-sm text-ink-soft">
            Restore the original fictional dataset. This deletes local notes,
            checksums, reports, camera event trails and preview links, and
            resets alert and review actions. Your downloaded files are not
            affected.
          </p>
          <button
            disabled={resetting}
            onClick={() => setReset(true)}
            className="mt-4 rounded-lg border border-seal-line px-4 py-2 text-sm font-semibold text-seal disabled:opacity-50"
          >
            {resetting ? "Resetting…" : "Reset demo data"}
          </button>
        </section>
      )}
      <section className="glass rounded-2xl p-5">
        <p className="text-xs text-ink-soft">
          {IS_DEMO
            ? "This demo session remains on this browser until you sign out. No real accounts or services are connected."
            : "Signing out clears this browser's session. It does not revoke sessions on other devices."}
        </p>
        <button
          onClick={() => {
            alertSocket.disconnect();
            clearSession();
            window.location.assign("/login");
          }}
          className="mt-3 rounded-lg border border-paper-line px-4 py-2 text-sm text-seal"
        >
          Sign out of this browser
        </button>
      </section>
      <ConfirmModal
        open={reset}
        title="Reset the demo workspace?"
        message="All locally saved demo notes, checksums, reports, camera event trails, preview links and alert changes will be removed. Download anything you want to keep first."
        confirmLabel="Reset workspace"
        danger
        onCancel={() => setReset(false)}
        onConfirm={async () => {
          setReset(false);
          setResetting(true);
          try {
            await post("/api/demo/reset", {});
            window.location.assign("/");
          } catch {
            errorToast("Could not reset the demo");
            setResetting(false);
          }
        }}
      />
    </div>
  );
}
