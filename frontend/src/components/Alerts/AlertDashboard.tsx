import { IS_DEMO } from "@/config/runtime";
import { triggerDemoAlert } from "@/services/demoService";
import { enableBrowserNotifications } from "@/services/preferences";
import { errorToast } from "@/components/Common/ToastNotification";
/**
 * AlertDashboard — alert list with filters, real-time updates and stats panel.
 */
import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { BellRing, Plus } from "lucide-react";
import { AppDispatch, RootState } from "@/store";
import { fetchActiveAlerts, fetchAlertStats } from "@/store/alertSlice";
import { useRealTimeAlerts } from "@/hooks/useRealTimeAlerts";
import { alertSocket } from "@/services/websocket";
import AlertCard from "./AlertCard";
import AlertRulesManager from "./AlertRulesManager";
import LoadingSkeleton from "@/components/Common/LoadingSkeleton";
import { successToast } from "@/components/Common/ToastNotification";

type Filter = "ALL" | "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export default function AlertDashboard() {
  const dispatch = useDispatch<AppDispatch>();
  const alerts = useSelector((state: RootState) => state.alerts.active);
  const stats = useSelector((state: RootState) => state.alerts.stats);
  const loading = useSelector((state: RootState) => state.alerts.loading);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [showRules, setShowRules] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const error = useSelector((state: RootState) => state.alerts.error);

  useEffect(() => {
    dispatch(fetchActiveAlerts());
    dispatch(fetchAlertStats());
    alertSocket.connect();
  }, [dispatch]);

  const filtered = useMemo(
    () =>
      filter === "ALL" ? alerts : alerts.filter((a) => a.severity === filter),
    [alerts, filter],
  );

  const counts = useMemo(() => {
    const c = { ALL: alerts.length, CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    alerts.forEach((a) => {
      c[a.severity as Filter] += 1;
    });
    return c;
  }, [alerts]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <BellRing className="h-6 w-6 text-risk-critical" /> Alerts
          </h1>
          <p className="text-sm text-text-secondary">
            Total: {alerts.length} · Critical: {counts.CRITICAL} · High:{" "}
            {counts.HIGH} · Medium: {counts.MEDIUM}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {IS_DEMO && (
            <button
              disabled={triggering}
              onClick={async () => {
                setTriggering(true);
                try {
                  await triggerDemoAlert();
                } catch {
                  errorToast("Could not trigger a demo alert");
                } finally {
                  setTriggering(false);
                }
              }}
              className="rounded-lg border border-teal/40 bg-teal-soft px-4 py-2 text-sm font-semibold text-teal disabled:opacity-50"
            >
              {triggering ? "Triggering…" : "Trigger demo alert"}
            </button>
          )}
          <button
            onClick={() => setShowRules((s) => !s)}
            className="flex items-center gap-2 rounded-lg bg-accent-blue px-4 py-2 text-sm font-semibold text-white transition hover:bg-seal-dark"
          >
            <Plus className="h-4 w-4" /> Create Rule
          </button>
        </div>
      </div>

      {IS_DEMO && (
        <p className="text-xs text-teal">
          Synthetic events only. Triggering an alert uses a local event bus; no
          live monitoring stream is connected.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-risk-critical">
          {error}
        </p>
      )}
      {showRules && <AlertRulesManager onClose={() => setShowRules(false)} />}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {(["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              filter === f
                ? "border-seal bg-seal text-ink-onred"
                : "border-paper-line bg-paper-raised text-ink-soft hover:bg-paper-sunk"
            }`}
          >
            {f} ({counts[f]})
          </button>
        ))}
      </div>

      {/* List + stats */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {loading && alerts.length === 0 ? (
            <div className="glass rounded-2xl p-6">
              <LoadingSkeleton lines={6} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="glass rounded-2xl p-10 text-center text-sm text-text-muted">
              No {filter !== "ALL" ? filter.toLowerCase() : ""} alerts.
            </div>
          ) : (
            filtered.map((alert) => <AlertCard key={alert.id} alert={alert} />)
          )}
        </div>

        {/* Statistics panel */}
        <div className="space-y-4">
          <div className="glass rounded-2xl p-4">
            <h3 className="mb-3 text-sm font-semibold">Alert Statistics</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-text-muted">Total alerts</dt>
                <dd className="font-semibold">
                  {stats?.total ?? alerts.length}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-muted">Critical</dt>
                <dd className="font-semibold text-risk-critical">
                  {stats?.critical ?? counts.CRITICAL}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-muted">High</dt>
                <dd className="font-semibold text-risk-high">
                  {stats?.high ?? counts.HIGH}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-muted">Medium</dt>
                <dd className="font-semibold text-risk-medium">
                  {stats?.medium ?? counts.MEDIUM}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-muted">Low</dt>
                <dd className="font-semibold text-risk-low">
                  {stats?.low ?? counts.LOW}
                </dd>
              </div>
            </dl>
          </div>

          <div className="glass rounded-2xl p-4 text-xs text-text-secondary">
            <h3 className="mb-2 text-sm font-semibold text-text-primary">
              Review workflow
            </h3>
            <p>
              Open an alert to review its details, assign it to yourself,
              escalate it or resolve it. Resolved alerts leave the active list.
            </p>
            <button
              onClick={async () => {
                try {
                  const status = await enableBrowserNotifications();
                  if (status === "granted")
                    successToast("Browser notifications enabled");
                  else
                    errorToast(
                      status === "unsupported"
                        ? "This browser does not support notifications"
                        : "Notifications were not enabled. Check your browser permissions.",
                    );
                } catch {
                  errorToast(
                    "Browser notifications are unavailable in this context",
                  );
                }
              }}
              className="mt-3 w-full rounded-lg border border-border py-2 font-semibold transition hover:bg-bg-hover"
            >
              Enable browser notifications
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
