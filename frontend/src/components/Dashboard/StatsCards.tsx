/**
 * StatsCards — the four headline metric cards on the dashboard.
 * Dossier styling: serif numerals, mono captions, hairline rules.
 */
import { Users, Briefcase, BellRing, Network } from "lucide-react";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import { formatNumber } from "@/utils/formatters";

export default function StatsCards() {
  const statistics = useSelector((state: RootState) => state.network.statistics);
  const alerts = useSelector((state: RootState) => state.alerts.active);

  const totalCriminals = statistics?.nodes?.person ?? 0;
  const activeInvestigations = statistics?.nodes?.crimeevent ?? 0;
  const alertCount = alerts.length;
  const networkNodes = statistics?.total_nodes ?? 0;

  const cards = [
    {
      label: "Persons of interest",
      value: totalCriminals,
      icon: Users,
      accent: "text-seal",
      bar: "bg-seal",
      sub: "criminals in the graph",
    },
    {
      label: "Investigations",
      value: activeInvestigations,
      icon: Briefcase,
      accent: "text-teal",
      bar: "bg-teal",
      sub: "crime events tracked",
    },
    {
      label: "Active alerts",
      value: alertCount,
      icon: BellRing,
      accent: "text-risk-critical",
      bar: "bg-risk-critical",
      sub: "real-time feed",
    },
    {
      label: "Network nodes",
      value: networkNodes,
      icon: Network,
      accent: "text-risk-medium",
      bar: "bg-risk-medium",
      sub: "total entities mapped",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(({ label, value, icon: Icon, accent, bar, sub }) => (
        <div
          key={label}
          className="relative overflow-hidden rounded-lg border border-paper-line bg-paper-raised shadow-card transition hover:border-seal-line"
        >
          <span className={`absolute left-0 top-0 h-full w-[3px] ${bar}`} />
          <div className="p-5 pl-6">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
                {label}
              </p>
              <Icon className={`h-5 w-5 ${accent}`} />
            </div>
            <p className="dossier-title mt-2 text-4xl font-bold tabular-nums">
              {formatNumber(value)}
            </p>
            <div className="mt-2 h-px w-full bg-paper-line" />
            <p className="mt-2 font-mono text-[11px] text-ink-soft">{sub}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
