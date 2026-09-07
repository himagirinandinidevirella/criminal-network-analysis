/**
 * CriminalCard — a compact card used in search/investigation result lists.
 */
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import type { Criminal } from "@/types/criminal.types";
import RiskBadge from "@/components/Common/RiskBadge";
import { levelFor } from "@/utils/riskUtils";

interface Props {
  criminal: Criminal;
}

export default function CriminalCard({ criminal }: Props) {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(`/criminal/${criminal.id}`)}
      className="glass flex w-full items-center gap-4 rounded-2xl p-4 text-left transition hover:border-seal-line"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-bg-tertiary text-lg">
        👤
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-semibold">{criminal.name}</span>
          {criminal.important_flag && <span className="text-risk-critical">⭐</span>}
        </div>
        <p className="truncate text-xs text-text-muted">
          {criminal.criminal_id ?? "—"} · {criminal.address ?? "—"}
        </p>
        <p className="truncate text-xs text-text-secondary">
          {criminal.crime_types?.slice(0, 2).join(", ") || "—"}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <RiskBadge level={levelFor(criminal.risk_score)} score={criminal.risk_score} />
        <ChevronRight className="h-4 w-4 text-text-muted" />
      </div>
    </button>
  );
}
