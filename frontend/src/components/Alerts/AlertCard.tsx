import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { post, apiErrorMessage } from "@/services/api";
import { AppDispatch, RootState } from "@/store";
import { fetchActiveAlerts, fetchAlertStats } from "@/store/alertSlice";
import type { Alert } from "@/types/alert.types";
import { timeAgo } from "@/utils/formatters";
import { riskTextClass } from "@/utils/riskUtils";
import AlertDetailPanel from "./AlertDetailPanel";
import {
  successToast,
  errorToast,
} from "@/components/Common/ToastNotification";

export default function AlertCard({ alert }: { alert: Alert }) {
  const [showDetail, setShowDetail] = useState(false);
  const [busy, setBusy] = useState(false);
  const dispatch = useDispatch<AppDispatch>();
  const user = useSelector((state: RootState) => state.auth.user);
  const update = async (action: "resolve" | "assign" | "escalate") => {
    setBusy(true);
    try {
      const body =
        action === "resolve"
          ? { resolution_note: "Reviewed and resolved by officer" }
          : action === "assign"
            ? { officer_id: user?.badge_id || String(user?.id) }
            : {};
      await post(`/api/alerts/${alert.id}/${action}`, body);
      await Promise.all([
        dispatch(fetchActiveAlerts()).unwrap(),
        dispatch(fetchAlertStats()).unwrap(),
      ]);
      successToast(
        action === "resolve"
          ? "Alert resolved"
          : action === "assign"
            ? "Alert assigned to you"
            : "Alert escalated",
      );
    } catch (error) {
      errorToast(apiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <article
        className={`glass rounded-2xl border-l-4 p-4 ${alert.severity === "CRITICAL" ? "border-l-risk-critical" : "border-l-paper-line"}`}
        aria-label={alert.title}
      >
        <div className="flex flex-wrap gap-2 text-xs">
          <span className={`font-bold ${riskTextClass(alert.severity)}`}>
            {alert.severity}
          </span>
          <span className="text-ink-soft">
            {alert.category} · {timeAgo(alert.created_at)}
          </span>
          {alert.status === "ESCALATED" && (
            <strong className="text-seal">Escalated</strong>
          )}
        </div>
        <h2 className="mt-2 text-sm font-semibold">{alert.title}</h2>
        <p className="mt-1 text-xs leading-relaxed text-ink-soft">
          {alert.description}
        </p>
        {alert.criminal_name && (
          <p className="mt-2 text-xs text-ink-soft">
            Subject: {alert.criminal_name}
          </p>
        )}
        {alert.assigned_to && (
          <p className="mt-1 break-words text-xs text-teal">
            Assigned to: {alert.assigned_to}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => setShowDetail(true)}
            className="rounded-lg bg-seal px-3 py-1.5 text-xs font-semibold text-white hover:bg-seal-dark"
          >
            View
          </button>
          <button
            disabled={busy || alert.assigned_to === user?.badge_id}
            onClick={() => update("assign")}
            className="rounded-lg border border-paper-line px-3 py-1.5 text-xs text-ink-soft hover:bg-paper-sunk disabled:opacity-50"
          >
            Assign to me
          </button>
          <button
            disabled={busy || alert.status === "ESCALATED"}
            onClick={() => update("escalate")}
            className="rounded-lg border border-risk-critical/40 px-3 py-1.5 text-xs text-risk-critical disabled:opacity-50"
          >
            Escalate
          </button>
          <button
            disabled={busy}
            onClick={() => update("resolve")}
            className="ml-auto rounded-lg border border-risk-low/40 px-3 py-1.5 text-xs text-risk-low disabled:opacity-50"
          >
            Resolve
          </button>
        </div>
      </article>
      {showDetail && (
        <AlertDetailPanel alert={alert} onClose={() => setShowDetail(false)} />
      )}
    </>
  );
}
