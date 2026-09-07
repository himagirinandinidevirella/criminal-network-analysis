/**
 * EventCard — one timeline event node.
 */
import type { TimelineEvent } from "@/types/criminal.types";
import { formatDateTime } from "@/utils/formatters";

interface Props {
  event: TimelineEvent;
}

const KIND_STYLE: Record<string, { dot: string; ring: string }> = {
  CRIME: { dot: "bg-risk-critical", ring: "ring-risk-critical/30" },
  COMMUNICATION: { dot: "bg-accent-cyan", ring: "ring-accent-cyan/30" },
  FINANCIAL: { dot: "bg-risk-medium", ring: "ring-risk-medium/30" },
};

export default function EventCard({ event }: Props) {
  const style = KIND_STYLE[event.kind] ?? KIND_STYLE.CRIME;

  return (
    <li className="relative">
      <span
        className={`absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ${style.dot} ${style.ring}`}
      />
      <div className="rounded-lg bg-bg-tertiary p-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wide text-text-muted">{event.kind}</span>
          <span className="text-[10px] text-text-muted">{formatDateTime(event.date)}</span>
        </div>
        <p className="mt-0.5 text-sm font-medium">{event.label}</p>
        {event.detail && <p className="text-xs text-text-secondary">{event.detail}</p>}
        {event.case_number && <p className="text-xs text-text-muted">Case: {event.case_number}</p>}
      </div>
    </li>
  );
}
