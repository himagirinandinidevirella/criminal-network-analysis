/**
 * Settings page — user profile, permissions and system info.
 */
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { Shield, User, Bell, Database } from "lucide-react";
import { RootState } from "@/store";
import { get } from "@/services/api";
import type { MeResponse } from "@/types/api.types";
import { clearSession } from "@/services/api";

export default function Settings() {
  const user = useSelector((state: RootState) => state.auth.user);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    get<MeResponse>("/api/auth/me").then(setMe).catch(() => {});
    get<{ data: Record<string, unknown> }>("/health").then((h) => setHealth(h.data)).catch(() => {});
  }, []);

  const permissions = me?.permissions;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="glass rounded-2xl p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <User className="h-4 w-4 text-accent-blue" /> Profile
          </h2>
          <dl className="space-y-2 text-sm">
            {[
              ["Name", user?.name ?? "—"],
              ["Badge ID", user?.badge_id ?? "—"],
              ["Role", user?.role ?? "—"],
              ["Department", user?.department ?? "—"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-border/50 pb-1">
                <dt className="text-text-muted">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="glass rounded-2xl p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Shield className="h-4 w-4 text-risk-low" /> Permissions
          </h2>
          {permissions ? (
            <ul className="space-y-1.5 text-sm">
              {Object.entries(permissions).map(([k, v]) => (
                <li key={k} className="flex items-center justify-between">
                  <span className="text-text-secondary">{k.replace(/_/g, " ")}</span>
                  <span className={v ? "text-risk-low" : "text-risk-critical"}>{v ? "✓" : "✗"}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-text-muted">Loading permissions…</p>
          )}
        </div>

        <div className="glass rounded-2xl p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Database className="h-4 w-4 text-accent-cyan" /> System Status
          </h2>
          {health ? (
            <dl className="space-y-2 text-sm">
              {Object.entries(health).map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-border/50 pb-1">
                  <dt className="text-text-muted">{k}</dt>
                  <dd>{String(v)}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-xs text-text-muted">Checking backend…</p>
          )}
        </div>

        <div className="glass rounded-2xl p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Bell className="h-4 w-4 text-risk-medium" /> Notifications
          </h2>
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <input type="checkbox" className="accent-accent-blue" defaultChecked /> Real-time alerts
          </label>
          <label className="mt-2 flex items-center gap-2 text-sm text-text-secondary">
            <input type="checkbox" className="accent-accent-blue" defaultChecked /> Sound on critical alert
          </label>
          <button
            onClick={() => {
              if ("Notification" in window) Notification.requestPermission();
            }}
            className="mt-4 rounded-lg border border-border px-3 py-1.5 text-xs text-text-secondary transition hover:bg-bg-hover"
          >
            Enable browser notifications
          </button>
        </div>
      </div>

      <div className="glass rounded-2xl p-5 text-xs text-text-muted">
        <p>Session timeout: 8 hours of inactivity · All access is logged and monitored.</p>
        <button
          onClick={() => {
            clearSession();
            window.location.href = "/login";
          }}
          className="mt-3 rounded-lg border border-risk-critical/50 px-3 py-1.5 text-risk-critical transition hover:bg-risk-critical/10"
        >
          Sign out all devices
        </button>
      </div>
    </div>
  );
}
