/**
 * AssociatesList — known associates of a criminal.
 */
import { useNavigate } from "react-router-dom";
import type { Associate } from "@/types/criminal.types";
import RiskBadge from "@/components/Common/RiskBadge";
import { levelFor } from "@/utils/riskUtils";

interface Props {
  associates: Associate[];
}

export default function AssociatesList({ associates }: Props) {
  const navigate = useNavigate();

  if (associates.length === 0) {
    return (
      <div className="glass rounded-2xl p-8 text-center text-sm text-text-muted">
        No known associates.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {associates.slice(0, 20).map((a) => (
        <button
          key={a.id}
          onClick={() => navigate(`/criminal/${a.id}`)}
          className="glass flex items-center gap-3 rounded-2xl p-3 text-left transition hover:border-seal-line"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-bg-tertiary">
            👤
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{a.name}</p>
            <p className="text-xs text-text-muted">
              {a.crime_types?.slice(0, 2).join(", ") || "—"}
            </p>
          </div>
          <RiskBadge level={levelFor(a.risk_score)} score={a.risk_score} />
        </button>
      ))}
    </div>
  );
}
