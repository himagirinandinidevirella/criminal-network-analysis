/** Person and non-person details without sending every graph node to the person API. */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { User, FileBarChart } from "lucide-react";
import { RootState } from "@/store";
import { get } from "@/services/api";
import type { CriminalProfile } from "@/types/criminal.types";
import RiskBadge from "@/components/Common/RiskBadge";
import LoadingSkeleton from "@/components/Common/LoadingSkeleton";
import ErrorState from "@/components/Common/ErrorState";
import { levelFor } from "@/utils/riskUtils";

export default function NodeDetailsPanel({
  nodeId,
}: {
  nodeId: string | null;
}) {
  const navigate = useNavigate();
  const graph = useSelector((state: RootState) => state.network.graph);
  const node = graph?.nodes.find((n) => n.data.id === nodeId)?.data;
  const [profile, setProfile] = useState<CriminalProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    setProfile(null);
    setError("");
    if (!nodeId || (node && node.label !== "Person")) {
      setLoading(false);
      return;
    }
    setLoading(true);
    get<CriminalProfile>(`/api/criminals/${nodeId}`)
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .catch(() => {
        if (!cancelled) setError("This person's profile could not be loaded.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [nodeId, node?.label]);
  if (!nodeId)
    return (
      <div className="glass rounded-2xl p-4 text-center text-sm text-ink-soft">
        <User className="mx-auto mb-2 h-6 w-6" />
        Select a node or use Inspect entity to view details.
      </div>
    );
  if (node && node.label !== "Person") {
    const connections =
      graph?.edges.filter(
        (e) => e.data.source === nodeId || e.data.target === nodeId,
      ) ?? [];
    return (
      <section className="glass rounded-2xl p-4">
        <p className="text-xs uppercase tracking-wide text-teal">
          {node.label}
        </p>
        <h2 className="mt-1 break-words text-base font-bold">
          {String(node.name ?? node.id)}
        </h2>
        <dl className="mt-3 space-y-2 text-xs">
          {Object.entries(node)
            .filter(
              ([key, value]) =>
                !["id", "name", "label", "centrality", "synthetic"].includes(
                  key,
                ) && ["string", "number", "boolean"].includes(typeof value),
            )
            .slice(0, 8)
            .map(([key, value]) => (
              <div key={key} className="break-words">
                <dt className="text-ink-faint">{key.replace(/_/g, " ")}</dt>
                <dd>{String(value)}</dd>
              </div>
            ))}
        </dl>
        <p className="mt-3 text-xs text-ink-soft">
          {connections.length} connections in this view.
        </p>
      </section>
    );
  }
  if (loading)
    return (
      <div className="glass rounded-2xl p-4">
        <LoadingSkeleton lines={5} />
      </div>
    );
  if (error) return <ErrorState message={error} />;
  if (!profile) return null;
  const { person, risk, associates, accounts } = profile;
  return (
    <section className="glass rounded-2xl p-4">
      <p className="text-xs uppercase tracking-wide text-teal">Person</p>
      <h2 className="mt-1 text-base font-bold">{person.name}</h2>
      <p className="mt-1 text-xs text-ink-soft">{person.criminal_id}</p>
      <div className="mt-2">
        <RiskBadge level={levelFor(risk.score)} score={risk.score} />
      </div>
      <p className="mt-3 text-xs text-ink-soft">
        {person.crime_types.join(" · ")}
      </p>
      <p className="mt-2 text-xs text-ink-soft">
        {associates.length} direct associates ·{" "}
        {accounts.filter((a) => a.flagged).length} flagged accounts
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          onClick={() => navigate(`/criminal/${person.id}`)}
          className="flex items-center justify-center gap-1.5 rounded-lg bg-seal py-2 text-xs font-semibold text-white"
        >
          <User className="h-3.5 w-3.5" />
          Profile
        </button>
        <button
          onClick={() => navigate(`/reports?criminal=${person.id}`)}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-paper-line py-2 text-xs font-semibold text-ink-soft"
        >
          <FileBarChart className="h-3.5 w-3.5" />
          Report
        </button>
      </div>
    </section>
  );
}
