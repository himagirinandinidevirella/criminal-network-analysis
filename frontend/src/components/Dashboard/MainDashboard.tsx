/**
 * MainDashboard — assembles the full dashboard layout.
 * Opens with an evaluator-facing "briefing" strip (what this system does).
 */
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { ArrowRight, Database, Radar, Rocket } from "lucide-react";
import { AppDispatch, RootState } from "@/store";
import { fetchStatistics } from "@/store/networkSlice";
import { fetchActiveAlerts, fetchAlertStats } from "@/store/alertSlice";
import StatsCards from "./StatsCards";
import CrimeTypeChart from "./CrimeTypeChart";
import RiskDistributionChart from "./RiskDistributionChart";
import GeographicSummary from "./GeographicSummary";
import ActivityFeed from "./ActivityFeed";
import NetworkPreview from "./NetworkPreview";

const PIPELINE = [
  { icon: Database, step: "01", title: "Ingest", text: "FIRs, call records, financial trails, seized devices" },
  { icon: Radar, step: "02", title: "Analyze", text: "Entity graph + AI risk scoring & anomaly detection" },
  { icon: Rocket, step: "03", title: "Act", text: "Real-time alerts, dossiers, blockchain-sealed evidence" },
];

export default function MainDashboard() {
  const dispatch = useDispatch<AppDispatch>();
  const alerts = useSelector((state: RootState) => state.alerts.active);

  useEffect(() => {
    dispatch(fetchStatistics());
    dispatch(fetchActiveAlerts());
    dispatch(fetchAlertStats());
  }, [dispatch]);

  return (
    <div className="space-y-6">
      {/* ── Evaluator briefing strip ─────────────────────────────── */}
      <section className="overflow-hidden rounded-lg border border-paper-line bg-paper-raised shadow-card">
        <div className="flex items-center justify-between border-b border-paper-line px-6 py-2.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
            Briefing · System overview
          </span>
          <span className="stamp">SIH 2025</span>
        </div>

        <div className="grid gap-6 p-6 lg:grid-cols-[1fr_auto] lg:items-center lg:p-8">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-seal">
              AI-powered criminal network analysis
            </p>
            <h1 className="dossier-title mt-2 text-3xl font-bold leading-tight xl:text-4xl">
              See the network behind the crime.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft">
              CrimeNet fuses scattered case data into one living graph of persons,
              organisations, vehicles, accounts and crime events — then predicts who
              is most dangerous, and seals every action on an audit-proof ledger.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {PIPELINE.map(({ icon: Icon, step, title, text }) => (
                <div
                  key={step}
                  className="rounded-md border border-paper-line bg-paper-sunk/60 p-4"
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-seal" />
                    <span className="font-mono text-[10px] text-ink-faint">{step}</span>
                  </div>
                  <div className="dossier-title mt-2 text-base font-semibold">{title}</div>
                  <p className="mt-1 text-xs leading-relaxed text-ink-soft">{text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-row gap-2 lg:flex-col">
            <Link
              to="/overview"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-seal px-4 py-2.5 text-sm font-semibold text-ink-onred transition hover:bg-seal-dark"
            >
              How it works
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/network"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-paper-line px-4 py-2.5 text-sm font-medium text-ink-soft transition hover:bg-paper-sunk"
            >
              Explore the graph
            </Link>
          </div>
        </div>
      </section>

      <StatsCards />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <NetworkPreview />
        </div>
        <div>
          <RiskDistributionChart />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <CrimeTypeChart />
        <GeographicSummary />
        <ActivityFeed alerts={alerts} />
      </div>
    </div>
  );
}
