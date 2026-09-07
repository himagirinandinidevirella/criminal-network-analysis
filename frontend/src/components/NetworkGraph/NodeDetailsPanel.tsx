/**
 * NodeDetailsPanel — shows details for the selected graph node.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { User, Star, FileBarChart, Link2 } from "lucide-react";
import { get } from "@/services/api";
import type { CriminalProfile } from "@/types/criminal.types";
import RiskBadge from "@/components/Common/RiskBadge";
import LoadingSkeleton from "@/components/Common/LoadingSkeleton";
import { levelFor } from "@/utils/riskUtils";
import { successToast } from "@/components/Common/ToastNotification";

interface Props {
  nodeId: string | null;
}

export default function NodeDetailsPanel({ nodeId }: Props) {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<CriminalProfile | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!nodeId) {
      setProfile(null);
      return;
    }
    setLoading(true);
    get<CriminalProfile>(`/api/criminals/${nodeId}`)
      .then(setProfile)
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, [nodeId]);

  if (!nodeId) {
    return (
      <div className="glass rounded-2xl p-4 text-center text-sm text-text-muted">
        <User className="mx-auto mb-2 h-6 w-6" />
        Select a node to view details
      </div>
    );
  }

  if (loading) {
    return (
      <div className="glass rounded-2xl p-4">
        <LoadingSkeleton lines={5} />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="glass rounded-2xl p-4 text-sm text-text-secondary">
        This entity is not a person — person details are available for criminal nodes.
      </div>
    );
  }

  const { person, risk, associates, accounts } = profile;

  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-bg-tertiary text-xl">
          👤
        </div>
        <div className="min-w-0">
          <h3 className="truncate text-base font-bold">{person.name}</h3>
          <p className="text-xs text-text-muted">{person.criminal_id}</p>
          <div className="mt-1.5">
            <RiskBadge level={levelFor(risk.score)} score={risk.score} />
          </div>
        </div>
      </div>

      <div className="my-3 border-t border-border" />

      <div className="space-y-2 text-xs">
        <p className="text-text-secondary">
          <span className="text-text-muted">Crime types: </span>
          {person.crime_types?.join(", ") || "—"}
        </p>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-bg-tertiary p-2">
            <div className="text-base font-bold">{associates?.length ?? 0}</div>
            <div className="text-[10px] text-text-muted">Connections</div>
          </div>
          <div className="rounded-lg bg-bg-tertiary p-2">
            <div className="text-base font-bold">{accounts?.filter((a) => a.flagged).length ?? 0}</div>
            <div className="text-[10px] text-text-muted">Flagged accts</div>
          </div>
          <div className="rounded-lg bg-bg-tertiary p-2">
            <div className="text-base font-bold text-risk-high">{risk.score}</div>
            <div className="text-[10px] text-text-muted">Risk score</div>
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          onClick={() => navigate(`/criminal/${person.id}`)}
          className="flex items-center justify-center gap-1.5 rounded-lg bg-accent-blue py-2 text-xs font-semibold text-white transition hover:bg-seal-dark"
        >
          <User className="h-3.5 w-3.5" /> Profile
        </button>
        <button
          onClick={() => successToast("Added to watchlist")}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-xs font-semibold text-text-secondary transition hover:bg-bg-hover"
        >
          <Star className="h-3.5 w-3.5" /> Flag
        </button>
        <button
          onClick={() => navigate("/reports")}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-xs font-semibold text-text-secondary transition hover:bg-bg-hover"
        >
          <FileBarChart className="h-3.5 w-3.5" /> Report
        </button>
        <button
          onClick={() => successToast("Share link copied")}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-xs font-semibold text-text-secondary transition hover:bg-bg-hover"
        >
          <Link2 className="h-3.5 w-3.5" /> Share
        </button>
      </div>
    </div>
  );
}
