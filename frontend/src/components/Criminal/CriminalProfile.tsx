import { IS_DEMO } from "@/config/runtime";
import { useNavigate } from "react-router-dom";
import InvestigatorActions from "@/components/Actions/InvestigatorActions";
import DemoWorkspacePanel from "@/components/Demo/DemoWorkspacePanel";
/**
 * CriminalProfile — full profile view with tabbed sections and a sticky
 * investigator-actions bar.
 */
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  BadgeCheck,
  Star,
  FileBarChart,
  Link2,
  BellRing,
  Archive,
  Fingerprint,
  ScrollText,
} from "lucide-react";
import { AppDispatch, RootState } from "@/store";
import { fetchProfile } from "@/store/criminalSlice";
import { get } from "@/services/api";
import {
  getCriminalEvidence,
  getRecordHistory,
  getAuditTrail,
} from "@/services/blockchainService";
import type {
  CriminalProfile as Profile,
  TimelineEvent,
} from "@/types/criminal.types";
import type { AuditEntry } from "@/types/blockchain.types";
import RiskBadge from "@/components/Common/RiskBadge";
import LoadingSkeleton from "@/components/Common/LoadingSkeleton";
import ErrorState from "@/components/Common/ErrorState";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/Common/Tabs";
import { levelFor, riskTextClass } from "@/utils/riskUtils";
import { formatDate, formatCompactINR } from "@/utils/formatters";
import VehicleDetails from "./VehicleDetails";
import AccountDetails from "./AccountDetails";
import AssociatesList from "./AssociatesList";
import CriminalTimeline from "./CriminalTimeline";
import { successToast } from "@/components/Common/ToastNotification";

interface Props {
  criminalId: string;
}

export default function CriminalProfile({ criminalId }: Props) {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const profile = useSelector((state: RootState) => state.criminal.current);
  const loading = useSelector((state: RootState) => state.criminal.loading);
  const error = useSelector((state: RootState) => state.criminal.error);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [chainEvidenceCount, setChainEvidenceCount] = useState(0);
  const [recordOnChain, setRecordOnChain] = useState(false);
  const [auditTrail, setAuditTrail] = useState<AuditEntry[]>([]);

  useEffect(() => {
    dispatch(fetchProfile(criminalId));
    get<{ events: TimelineEvent[] }>(`/api/criminals/${criminalId}/timeline`)
      .then((r) => setTimeline(r.events))
      .catch(() => setTimeline([]));
    if (IS_DEMO) return;
    // Blockchain badges + immutable audit trail (best-effort).
    getCriminalEvidence(criminalId)
      .then((r) => setChainEvidenceCount(r.evidence.length))
      .catch(() => setChainEvidenceCount(0));
    getRecordHistory(criminalId)
      .then((r) => setRecordOnChain(r.count > 0))
      .catch(() => setRecordOnChain(false));
    getAuditTrail(criminalId)
      .then((r) => setAuditTrail(r.records.slice(0, 6)))
      .catch(() => setAuditTrail([]));
  }, [criminalId, dispatch]);

  if (loading && (!profile || profile.person.id !== criminalId)) {
    return (
      <div className="glass rounded-2xl p-6">
        <LoadingSkeleton lines={8} />
      </div>
    );
  }

  if (error && (!profile || profile.person.id !== criminalId)) {
    return (
      <ErrorState
        message={error}
        onRetry={() => dispatch(fetchProfile(criminalId))}
      />
    );
  }

  if (!profile || profile.person.id !== criminalId) return null;

  const { person, risk, vehicles, accounts, associates, crimes } = profile;
  const level = levelFor(risk.score);

  return (
    <div className="space-y-4">
      {/* Header card */}
      <div className="glass rounded-2xl p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-bg-tertiary text-4xl">
            👤
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">
                {person.name}
              </h1>
              <RiskBadge level={level} score={risk.score} size="md" />
              {person.verified && (
                <span className="inline-flex items-center gap-1 rounded-full border border-risk-low/40 bg-risk-low/10 px-2 py-0.5 text-xs text-risk-low">
                  <BadgeCheck className="h-3.5 w-3.5" /> Verified
                </span>
              )}
              {!IS_DEMO && chainEvidenceCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-accent-cyan/40 bg-accent-cyan/10 px-2 py-0.5 text-xs text-accent-cyan">
                  <Fingerprint className="h-3.5 w-3.5" />
                  {chainEvidenceCount} evidence on-chain
                </span>
              )}
              {recordOnChain && (
                <span className="inline-flex items-center gap-1 rounded-full border border-accent-cyan/40 bg-accent-cyan/10 px-2 py-0.5 text-xs text-accent-cyan">
                  <Link2 className="h-3.5 w-3.5" /> Immutable record
                </span>
              )}
            </div>
            <p className="text-sm text-text-muted">
              Criminal ID: {person.criminal_id ?? "—"} · Age:{" "}
              {person.age ?? "—"} · {person.gender ?? "—"} ·{" "}
              {person.address ?? "—"}
            </p>
            <p className="mt-1 text-sm text-text-secondary">
              Status:{" "}
              <span className={riskTextClass(level)}>{person.status}</span>
            </p>
            {person.aliases?.length > 0 && (
              <p className="mt-1 text-xs text-text-muted">
                Aliases: {person.aliases.join(", ")}
              </p>
            )}
            {person.important_flag && (
              <p className="mt-2 inline-flex items-center gap-1 rounded-lg bg-risk-critical/15 px-2 py-1 text-xs text-risk-critical">
                <Star className="h-3.5 w-3.5" /> Priority watchlist
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate(`/reports?criminal=${person.id}`)}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-text-secondary transition hover:bg-bg-hover"
            >
              <FileBarChart className="h-4 w-4" /> Report
            </button>
            <button
              onClick={() => navigate(`/network?node=${person.id}`)}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-text-secondary transition hover:bg-bg-hover"
            >
              <Link2 className="h-4 w-4" /> Network
            </button>
          </div>
        </div>
      </div>

      {IS_DEMO && (
        <p className="rounded-xl border border-teal/20 bg-teal-soft p-3 text-sm text-teal">
          Fictional profile. Scores and factors are illustrative fixture values,
          not an AI assessment or evidence about a real person.
        </p>
      )}
      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap">
          {["overview", "network", "vehicles", "accounts", "timeline"].map(
            (t) => (
              <TabsTrigger key={t} value={t}>
                {t[0].toUpperCase() + t.slice(1)}
              </TabsTrigger>
            ),
          )}
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Personal info */}
            <div className="glass rounded-2xl p-4">
              <h3 className="mb-3 text-sm font-semibold">
                Personal Information
              </h3>
              <dl className="space-y-2 text-sm">
                {[
                  ["Nationality", person.nationality ?? "—"],
                  ["Known since", formatDate(person.created_at)],
                  ["Crime types", person.crime_types?.join(", ") || "—"],
                  [
                    "Flagged accounts",
                    String(accounts.filter((a) => a.flagged).length),
                  ],
                ].map(([k, v]) => (
                  <div
                    key={k}
                    className="flex justify-between border-b border-border/50 pb-1"
                  >
                    <dt className="text-text-muted">{k}</dt>
                    <dd className="text-text-primary">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Risk gauge */}
            <div className="glass rounded-2xl p-4">
              <h3 className="mb-3 text-sm font-semibold">
                {IS_DEMO ? "Sample Risk Score" : "Risk Score"}
              </h3>
              <div className="flex items-center gap-4">
                <div className={`text-5xl font-bold ${riskTextClass(level)}`}>
                  {risk.score}
                </div>
                <div className="text-sm">
                  <p className={`font-semibold ${riskTextClass(level)}`}>
                    {level} RISK
                  </p>
                  <p className="text-xs text-text-muted">out of 100</p>
                </div>
              </div>
              <div className="mt-3 space-y-1.5">
                {risk.factors?.slice(0, 5).map((f) => (
                  <div
                    key={f.feature}
                    className="flex items-center gap-2 text-xs"
                  >
                    <span className="w-36 truncate text-text-muted">
                      {f.feature.replace(/_/g, " ")}
                    </span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-hover">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-risk-medium to-risk-critical"
                        style={{
                          width: `${Math.min(100, Math.abs(f.contribution) * 4)}%`,
                        }}
                      />
                    </div>
                    <span className="w-8 text-right text-text-secondary">
                      +{f.contribution}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Crime history */}
          <div className="glass mt-4 rounded-2xl p-4">
            <h3 className="mb-3 text-sm font-semibold">Crime History</h3>
            {crimes.length === 0 ? (
              <p className="py-4 text-center text-xs text-text-muted">
                No crime records
              </p>
            ) : (
              <ul className="space-y-2">
                {crimes.slice(0, 8).map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between rounded-lg bg-bg-tertiary px-3 py-2 text-sm"
                  >
                    <span>
                      {formatDate(c.date)}: {c.crime_type}
                    </span>
                    <span className="text-xs text-text-muted">{c.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Immutable audit trail */}
          {!IS_DEMO && (
            <div className="glass mt-4 rounded-2xl p-4">
              <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
                <ScrollText className="h-4 w-4 text-accent-cyan" /> Immutable
                Audit Trail
              </h3>
              {auditTrail.length === 0 ? (
                <p className="py-2 text-center text-xs text-text-muted">
                  No on-chain audit entries yet
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {auditTrail.map((a, i) => (
                    <li
                      key={`${a.logId}-${i}`}
                      className="flex items-center gap-3 rounded-lg bg-bg-tertiary px-3 py-2 text-xs"
                    >
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${a.result === "UNAUTHORIZED" ? "bg-risk-critical" : "bg-risk-low"}`}
                      />
                      <span className="font-mono text-[10px] text-text-muted">
                        {a.formattedTimestamp ?? "—"}
                      </span>
                      <span className="font-semibold text-text-primary">
                        {a.action}
                      </span>
                      <span className="ml-auto text-text-muted">
                        {a.officerBadgeId}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="network">
          <AssociatesList associates={associates} />
        </TabsContent>

        <TabsContent value="vehicles">
          <VehicleDetails vehicles={vehicles} />
        </TabsContent>

        <TabsContent value="accounts">
          <AccountDetails accounts={accounts} />
        </TabsContent>

        <TabsContent value="timeline">
          <CriminalTimeline events={timeline} />
        </TabsContent>
      </Tabs>

      {IS_DEMO && <DemoWorkspacePanel criminalId={criminalId} />}
      {/* Sticky investigator actions bar */}
      <div className="glass sticky bottom-2 flex flex-wrap items-center gap-2 rounded-2xl p-3">
        <span className="text-xs font-semibold text-text-muted">Actions:</span>
        <InvestigatorActions
          criminalId={criminalId}
          verified={person.verified}
          flagged={person.important_flag}
          onChanged={() => dispatch(fetchProfile(criminalId))}
        />
        <span className="ml-auto text-[11px] text-text-muted">
          Suspicious total:{" "}
          {formatCompactINR(
            accounts.reduce((s, a) => s + a.total_suspicious_amount, 0),
          )}
        </span>
      </div>
    </div>
  );
}
