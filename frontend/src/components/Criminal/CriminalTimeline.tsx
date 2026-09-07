/**
 * CriminalTimeline — chronological event list for a criminal.
 */
import type { TimelineEvent } from "@/types/criminal.types";
import { formatDateTime } from "@/utils/formatters";

interface Props {
  events: TimelineEvent[];
}

const KIND_ICON: Record<string, string> = {
  CRIME: "🔴",
  COMMUNICATION: "📱",
  FINANCIAL: "💰",
};

export default function CriminalTimeline({ events }: Props) {
  if (events.length === 0) {
    return (
      <div className="glass rounded-2xl p-8 text-center text-sm text-text-muted">
        No timeline events recorded.
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl p-4">
      <ol className="relative space-y-4 border-l border-border pl-5">
        {events.slice(0, 30).map((e, i) => (
          <li key={i} className="relative">
            <span className="absolute -left-[26px] top-1 text-xs">{KIND_ICON[e.kind] ?? "•"}</span>
            <p className="text-xs text-text-muted">{formatDateTime(e.date)}</p>
            <p className="text-sm font-medium">{e.label}</p>
            {e.detail && <p className="text-xs text-text-secondary">{e.detail}</p>}
          </li>
        ))}
      </ol>
    </div>
  );
}
