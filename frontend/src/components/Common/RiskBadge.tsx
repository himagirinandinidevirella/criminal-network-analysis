/**
 * RiskBadge — a coloured pill showing a risk level / score.
 */
import type { RiskLevel } from "@/types/criminal.types";
import { riskBgClass, riskTextClass } from "@/utils/riskUtils";

interface Props {
  level: RiskLevel | string;
  score?: number;
  size?: "sm" | "md";
  pulse?: boolean;
}

export default function RiskBadge({ level, score, size = "sm", pulse }: Props) {
  const textClass = riskTextClass(level);
  const dotClass = riskBgClass(level);
  const padding = size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-border bg-bg-tertiary/60 font-semibold ${padding} ${textClass} ${pulse ? "animate-pulse-slow" : ""}`}
      aria-label={`Risk level: ${level}${score !== undefined ? ` (${score}/100)` : ""}`}
    >
      <span className={`h-2 w-2 rounded-full ${dotClass}`} />
      {level}
      {score !== undefined && <span className="text-text-secondary">· {score}</span>}
    </span>
  );
}
