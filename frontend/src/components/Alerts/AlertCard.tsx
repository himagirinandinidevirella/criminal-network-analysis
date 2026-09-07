/**
 * AlertCard — a single alert with action buttons.
 */
import { useState } from "react";
import { post } from "@/services/api";
import type { Alert } from "@/types/alert.types";
import { timeAgo } from "@/utils/formatters";
import { riskTextClass } from "@/utils/riskUtils";
import AlertDetailPanel from "./AlertDetailPanel";
import { successToast } from "@/components/Common/ToastNotification";

interface Props {
  alert: Alert;
}

const CATEGORY_ICON: Record<string, string> = {
  FINANCIAL: "💰",
  COMMUNICATION: "📱",
  LOCATION: "📍",
  NETWORK: "🕸️",
  TEMPORAL: "⏱️",
  BEHAVIORAL: "🧠",
};

export default function AlertCard({ alert }: Props) {
  const [showDetail, setShowDetail] = useState(false);
  const isCritical = alert.severity === "CRITICAL";

  const resolve = async () => {
    try {
      await post(`/api/alerts/${alert.id}/resolve`, { resolution_note: "Resolved by officer" });
      successToast("Alert resolved");
      window.location.reload();
    } catch {
      successToast("Could not resolve alert");
    }
  };

  return (
    <>
      <div
        className={`glass rounded-2xl p-4 ${isCritical ? "animate-slide-in border-risk-critical/50" : ""}`}
      >
        <div className={`rounded-t-2xl -mx-4 -mt-4 mb-3 h-1 ${isCritical ? "bg-risk-critical animate-pulse-slow" : "bg-bg-hover"}`} />
        <div className="flex items-start gap-3">
          <span className="text-xl">{CATEGORY_ICON[alert.category] ?? "🚨"}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold ${riskTextClass(alert.severity)}`}>
                {alert.severity}
              </span>
              <span className="text-xs text-text-muted">· {timeAgo(alert.created_at)}</span>
            </div>
            <h3 className="mt-0.5 text-sm font-semibold">{alert.title}</h3>
            <p className="mt-1 line-clamp-2 text-xs text-text-secondary">{alert.description}</p>
            {alert.criminal_name && (
              <p className="mt-1 text-xs text-text-muted">Subject: {alert.criminal_name}</p>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => setShowDetail(true)}
            className="rounded-lg bg-accent-blue px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-seal-dark"
          >
            View
          </button>
          <button className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:bg-bg-hover">
            Assign
          </button>
          {isCritical && (
            <button className="rounded-lg border border-risk-critical/50 px-3 py-1.5 text-xs font-medium text-risk-critical transition hover:bg-risk-critical/10">
              Escalate
            </button>
          )}
          <button
            onClick={resolve}
            className="ml-auto rounded-lg border border-risk-low/40 px-3 py-1.5 text-xs font-medium text-risk-low transition hover:bg-risk-low/10"
          >
            Resolve
          </button>
        </div>
      </div>

      {showDetail && <AlertDetailPanel alert={alert} onClose={() => setShowDetail(false)} />}
    </>
  );
}
