/**
 * Overview — "How it works" page for evaluators.
 * Explains the problem, the pipeline, the architecture and the data model.
 */
import { Link } from "react-router-dom";
import {
  Database, GitBranch, BrainCircuit, BellRing, FileBarChart, Link2,
  ArrowRight, ShieldCheck,
} from "lucide-react";

const PIPELINE = [
  {
    icon: Database,
    step: "01",
    title: "Ingest & unify",
    body: "FIRs, call records, financial trails, vehicle registrations and seized devices are normalised into one knowledge graph. Demo data models a synthetic “Operation Mumbai” cartel — 80 persons, 15 organisations, 1,000 transactions.",
  },
  {
    icon: GitBranch,
    step: "02",
    title: "Build the network",
    body: "Entities become nodes; every contact, payment and membership becomes an edge. 12 relationship types (KNOWS, TRANSFERRED_TO, MEMBER_OF, RIVAL_OF …) expose the structure the crime hides in.",
  },
  {
    icon: BrainCircuit,
    step: "03",
    title: "Score the risk",
    body: "Graph neural embeddings (GraphSAGE), XGBoost risk scoring, Isolation-Forest anomalies and LSTM sequence models flag the most dangerous actors and predict next moves.",
  },
  {
    icon: BellRing,
    step: "04",
    title: "Alert in real time",
    body: "A live WebSocket stream pushes alerts the moment a rule, anomaly or cyber-crime detector (phishing, ransomware, dark-web, crypto laundering …) fires.",
  },
  {
    icon: FileBarChart,
    step: "05",
    title: "Act & report",
    body: "One-click dossiers, network maps and court-ready PDF reports give investigators evidence they can actually use.",
  },
  {
    icon: Link2,
    step: "06",
    title: "Seal the evidence",
    body: "Every flag, verdict and evidence hash is written to a local Ethereum chain (5 Solidity contracts) and pinned to IPFS — an audit trail evaluators can verify on the Blockchain page.",
  },
];

const STACK: Array<{ layer: string; tech: string }> = [
  { layer: "Frontend", tech: "React 18 · TypeScript · Tailwind · Cytoscape · Leaflet · Recharts" },
  { layer: "API", tech: "FastAPI (Python) — 79 REST + WebSocket endpoints, JWT + bcrypt, AES-256 field encryption" },
  { layer: "Graph", tech: "Neo4j 5 — Cypher, full-text + range indexes, 12 relationship types" },
  { layer: "Relational", tech: "PostgreSQL 17 — users, cases, audit rows, relational reporting" },
  { layer: "Cache / rate-limit", tech: "Redis 8 — hot cache, login lockout, alert fan-out" },
  { layer: "ML", tech: "GraphSAGE · XGBoost · Isolation Forest · LSTM (rule-engine fallback when GPUs absent)" },
  { layer: "Blockchain", tech: "Solidity + Hardhat — 5 contracts on Ganache (chain 1337) · IPFS (5001)" },
];

const ENTITIES = ["Person", "Organization", "Location", "Vehicle", "Account", "Transaction", "CrimeEvent"];
const RELATIONSHIPS = [
  "KNOWS", "MEMBER_OF", "COMMUNICATED_WITH", "TRANSACTED_WITH", "OWNS_VEHICLE", "OWNS_ACCOUNT",
  "LOCATED_AT", "PARTICIPATED_IN", "TRANSFERRED_TO", "OPERATES_IN", "RIVAL_OF", "USED_IN",
];
const CONTRACTS = [
  "CriminalRecordContract", "EvidenceContract", "AuditContract",
  "AgencyShareContract", "ReportContract",
];
const CYBER = ["Ransomware", "Phishing", "Crypto Laundering", "Dark Web", "Coordinated Attack", "Social Engineering"];

export default function Overview() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <section className="rounded-lg border border-paper-line bg-paper-raised shadow-card">
        <div className="flex items-center justify-between border-b border-paper-line px-6 py-2.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
            Case file · Project walkthrough
          </span>
          <span className="stamp">For evaluators</span>
        </div>
        <div className="p-6 lg:p-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-seal">
            SIH 2025 · AI-Powered Criminal Network Analysis
          </p>
          <h1 className="dossier-title mt-2 text-3xl font-bold leading-tight xl:text-4xl">
            How CrimeNet works, end to end.
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-soft">
            Indian agencies already hold the data they need — FIRs, CDRs, bank trails, seized
            devices. What they lack is a way to connect it. CrimeNet turns isolated records into
            one living graph, scores the risk with AI, and locks every action on a blockchain.
          </p>
        </div>
      </section>

      {/* Pipeline */}
      <section className="rounded-lg border border-paper-line bg-paper-raised shadow-card">
        <div className="border-b border-paper-line px-6 py-2.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
            01 · The pipeline
          </span>
        </div>
        <div className="divide-y divide-paper-line">
          {PIPELINE.map(({ icon: Icon, step, title, body }) => (
            <div key={step} className="flex gap-4 p-6 lg:gap-6 lg:px-8">
              <div className="flex flex-col items-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-md border border-seal-line bg-seal-soft text-seal">
                  <Icon className="h-5 w-5" />
                </div>
                <span className="mt-2 font-mono text-[10px] text-ink-faint">{step}</span>
              </div>
              <div>
                <h2 className="dossier-title text-lg font-semibold">{title}</h2>
                <p className="mt-1 max-w-3xl text-sm leading-relaxed text-ink-soft">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Architecture / stack */}
      <section className="rounded-lg border border-paper-line bg-paper-raised shadow-card">
        <div className="border-b border-paper-line px-6 py-2.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
            02 · Architecture &amp; stack
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <tbody className="divide-y divide-paper-line">
              {STACK.map(({ layer, tech }) => (
                <tr key={layer}>
                  <td className="whitespace-nowrap px-6 py-3 font-mono text-[11px] font-semibold uppercase tracking-wide text-seal lg:px-8">
                    {layer}
                  </td>
                  <td className="px-6 py-3 text-ink-soft lg:px-8">{tech}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Data model */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-paper-line bg-paper-raised shadow-card">
          <div className="border-b border-paper-line px-6 py-2.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
              03 · Data model
            </span>
          </div>
          <div className="p-6">
            <h3 className="dossier-title text-base font-semibold">7 entity types</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {ENTITIES.map((e) => (
                <span key={e} className="rounded border border-paper-line bg-paper-sunk px-2.5 py-1 font-mono text-[11px] text-ink-soft">
                  {e}
                </span>
              ))}
            </div>
            <h3 className="dossier-title mt-6 text-base font-semibold">12 relationship types</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {RELATIONSHIPS.map((r) => (
                <span key={r} className="rounded border border-seal-line bg-seal-soft px-2.5 py-1 font-mono text-[11px] text-seal">
                  {r}
                </span>
              ))}
            </div>
            <h3 className="dossier-title mt-6 text-base font-semibold">Cyber-crime detectors</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {CYBER.map((c) => (
                <span key={c} className="rounded border border-paper-line bg-paper-sunk px-2.5 py-1 font-mono text-[11px] text-ink-soft">
                  {c}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-paper-line bg-paper-raised shadow-card">
          <div className="border-b border-paper-line px-6 py-2.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
              04 · Blockchain integrity
            </span>
          </div>
          <div className="p-6">
            <div className="flex items-center gap-2 text-seal">
              <ShieldCheck className="h-5 w-5" />
              <span className="dossier-title text-base font-semibold">5 on-chain contracts</span>
            </div>
            <div className="mt-3 space-y-2">
              {CONTRACTS.map((c) => (
                <div key={c} className="flex items-center gap-2 font-mono text-[12px] text-ink-soft">
                  <span className="h-1.5 w-1.5 rounded-full bg-seal" />
                  {c}.sol
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm leading-relaxed text-ink-soft">
              Evidence hashes are pinned to IPFS and recorded on a local Ethereum chain
              (Ganache, chain id 1337). Investigators from different agencies can share sealed
              records and verify any file's history — no tampering, no disputes.
            </p>
            <Link
              to="/blockchain"
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-seal hover:text-seal-dark"
            >
              Open the blockchain explorer <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </div>

      {/* Try it */}
      <section className="overflow-hidden rounded-lg border border-seal-line bg-seal-soft shadow-card">
        <div className="p-6 lg:p-8">
          <h2 className="dossier-title text-2xl font-bold">Try it in under a minute.</h2>
          <p className="mt-2 max-w-2xl text-sm text-ink-soft">
            Log in with a demo account, open the dashboard, then explore the “Operation Mumbai”
            network — or run the 5-minute guided demo from the login screen.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {[
              ["admin@crimenet.gov.in", "Admin@123"],
              ["officer@crimenet.gov.in", "Officer@123"],
              ["analyst@crimenet.gov.in", "Analyst@123"],
              ["senior@crimenet.gov.in", "Senior@123"],
            ].map(([u, p]) => (
              <div key={u} className="rounded-md border border-seal-line bg-paper-raised px-3 py-2 font-mono text-[11px]">
                <span className="text-seal">{u}</span>
                <span className="mx-1.5 text-ink-faint">/</span>
                <span>{p}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/network"
              className="inline-flex items-center gap-2 rounded-md bg-seal px-4 py-2.5 text-sm font-semibold text-ink-onred transition hover:bg-seal-dark"
            >
              Explore the network <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-md border border-seal-line bg-paper-raised px-4 py-2.5 text-sm font-semibold text-seal transition hover:bg-paper-sunk"
            >
              Back to dashboard
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
