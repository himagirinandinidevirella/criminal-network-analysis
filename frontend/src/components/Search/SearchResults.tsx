/**
 * SearchResults — ranked results across entity types.
 */
import { useNavigate } from "react-router-dom";
import {
  User,
  Building2,
  Car,
  Landmark,
  MapPin,
  ChevronRight,
} from "lucide-react";
import RiskBadge from "@/components/Common/RiskBadge";
import { levelFor } from "@/utils/riskUtils";

interface Props {
  results: Array<Record<string, unknown>>;
  searched?: boolean;
}

const KIND_ICON: Record<string, typeof User> = {
  Person: User,
  Organization: Building2,
  Vehicle: Car,
  Account: Landmark,
  Location: MapPin,
};

const KIND_COLOR: Record<string, string> = {
  Person: "text-seal",
  Organization: "text-teal",
  Vehicle: "text-risk-medium",
  Account: "text-text-secondary",
  Location: "text-ink-soft",
};

export default function SearchResults({ results, searched = false }: Props) {
  const navigate = useNavigate();

  if (results.length === 0) {
    return (
      <div className="glass rounded-2xl p-8 text-center text-sm text-text-muted">
        {searched
          ? "No matching entities. Try a broader query or reset the filters."
          : "Search a name such as Raja Khan, an alias, a vehicle or an account."}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-ink-soft" role="status">
        {results.length} matching {results.length === 1 ? "entity" : "entities"}
      </p>
      {results.map((r, i) => {
        const kind = String(r.kind ?? "Person");
        const Icon = KIND_ICON[kind] ?? User;
        const riskScore = Number(r.risk_score ?? 0);
        return (
          <button
            key={i}
            onClick={() => {
              if (kind === "Person") navigate(`/criminal/${r.id}`);
              else
                navigate(`/network?node=${encodeURIComponent(String(r.id))}`);
            }}
            className="glass flex w-full items-center gap-3 rounded-2xl p-3 text-left transition hover:border-seal-line"
          >
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl bg-bg-tertiary ${KIND_COLOR[kind] ?? ""}`}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {String(r.name ?? "—")}
              </p>
              <p className="text-xs text-text-muted">
                {kind}
                {r.crime_types
                  ? ` · ${String(r.crime_types).slice(0, 40)}`
                  : ""}
              </p>
            </div>
            {kind === "Person" && (
              <RiskBadge level={levelFor(riskScore)} score={riskScore} />
            )}
            {kind !== "Person" && r.hotspot_score !== undefined && (
              <span className="text-xs text-text-muted">
                hotspot {(Number(r.hotspot_score) * 100).toFixed(0)}
              </span>
            )}
            <ChevronRight className="h-4 w-4 text-text-muted" />
          </button>
        );
      })}
    </div>
  );
}
