/**
 * ActivityFeed — recent alerts timeline on the dashboard.
 */
import { BellRing, AlertTriangle } from "lucide-react";
import type { Alert } from "@/types/alert.types";
import { timeAgo } from "@/utils/formatters";
import { riskTextClass } from "@/utils/riskUtils";

interface Props {
  alerts: Alert[];
}

export default function ActivityFeed({ alerts }: Props) {
  const recent = alerts.slice(0, 6);

  return (
    <div className="glass rounded-2xl p-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <BellRing className="h-4 w-4 text-risk-medium" /> Recent Alerts
      </h2>
      {recent.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-text-muted">
          <AlertTriangle className="h-6 w-6" />
          <p className="text-xs">No active alerts</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {recent.map((alert) => (
            <li key={alert.id} className="flex items-start gap-3 border-b border-border/50 pb-2 last:border-0">
              <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${riskTextClass(alert.severity)} bg-current`} />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{alert.title}</p>
                <p className="truncate text-xs text-text-muted">
                  {alert.criminal_name ?? "System"} · {timeAgo(alert.created_at)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
