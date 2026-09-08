import { Link } from "react-router-dom";
import {
  ArrowRight,
  Database,
  GitBranch,
  FileText,
  Bell,
  Fingerprint,
  Search,
} from "lucide-react";

const STEPS = [
  {
    title: "Explore the network",
    icon: GitBranch,
    route: "/network",
    text: "Inspect 112 seeded entities. Filter by sample risk or crime type, find a shortest path, and simulate removing a node without modifying the dataset.",
  },
  {
    title: "Find a record",
    icon: Search,
    route: "/investigation",
    text: "Search names, aliases, vehicles, accounts and locations. The FIR preview uses dictionary matching and identifier patterns, not an NLP model.",
  },
  {
    title: "Review a case",
    icon: Database,
    route: "/criminal/raja-khan",
    text: "Open a fictional profile, check associates and case history, add a note, verify a record or flag it for review. Changes survive a reload.",
  },
  {
    title: "Try the alert workflow",
    icon: Bell,
    route: "/alerts",
    text: "Trigger a local sample event. View, assign, escalate and resolve alerts. Rule configuration is saved locally; no monitoring stream is connected.",
  },
  {
    title: "Export a real file",
    icon: FileText,
    route: "/reports",
    text: "Generate a profile, case, network or executive report as PDF, CSV, XLSX or JSON. Downloads contain selected sections and a mandatory synthetic-data notice.",
  },
  {
    title: "Check content integrity",
    icon: Fingerprint,
    route: "/blockchain",
    text: "Calculate an actual SHA-256 checksum in your browser. Change the text and compare hashes. This is not an immutable ledger or a legal certification.",
  },
];
export default function DemoOverview() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <section className="glass rounded-xl p-6 sm:p-8">
        <span className="stamp">Project walkthrough</span>
        <h1 className="dossier-title mt-4 text-3xl font-bold">
          A working demo. A clearly defined boundary.
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-soft">
          CrimeNet connects scattered records into an explorable graph. This
          standalone version runs entirely in your browser with 40 fictional
          people, 4 seeded organisations, 6 locations and their sample accounts,
          vehicles, cases and transfers.
        </p>
        <div className="mt-5 rounded-lg border border-seal-line bg-seal-soft p-4 text-sm text-seal">
          All records and scores are synthetic. Do not enter real personal,
          police, financial or biometric data. The demo is for software
          evaluation only, not operational decisions.
        </div>
      </section>
      <div className="grid gap-4 sm:grid-cols-2">
        {STEPS.map(({ title, icon: Icon, route, text }, i) => (
          <Link
            key={route}
            to={route}
            className="glass group rounded-xl p-5 transition hover:border-seal-line"
          >
            <div className="flex items-center gap-3 text-seal">
              <Icon className="h-5 w-5" />
              <span className="font-mono text-xs">0{i + 1}</span>
              <ArrowRight className="ml-auto h-4 w-4 transition group-hover:translate-x-1" />
            </div>
            <h2 className="dossier-title mt-3 text-xl font-semibold">
              {title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">{text}</p>
          </Link>
        ))}
      </div>
      <section className="glass rounded-xl p-6">
        <h2 className="dossier-title text-xl font-semibold">What runs here?</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="font-semibold">Real browser functionality</dt>
            <dd className="mt-1 text-ink-soft">
              Search and combined filters, graph rendering, breadth-first paths,
              connected-component simulation, local persistence, SHA-256 hashing
              and file exports. CCTV also supports four-view recording playback
              and an opt-in, browser-local face-detection model (boxes only, not
              identity matching).
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Illustrative only</dt>
            <dd className="mt-1 text-ink-soft">
              Risk scores, seeded group memberships and case records are
              fixtures. The assistant is a small rule-based query helper. No
              predictive models, biometric matching or blockchain transactions
              run in this mode.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">
              Local, not secure multi-user storage
            </dt>
            <dd className="mt-1 text-ink-soft">
              Demo login and roles are interface examples, not a security
              boundary. Notes and report snapshots use localStorage. Preview
              links work only in the browser that creates them. File contents
              are never stored or uploaded; only checksums are saved.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Full-stack source preserved</dt>
            <dd className="mt-1 text-ink-soft">
              The repository still includes FastAPI, Neo4j, PostgreSQL, Redis
              and model/blockchain integrations. Those require separate
              infrastructure, configuration and validation. See README.md and
              DEMO_GUIDE.md.
            </dd>
          </div>
        </dl>
        <p className="mt-5 text-sm text-ink-soft">
          Start locally with Node.js 20+:{" "}
          <code className="rounded bg-paper-sunk px-2 py-1">
            bash start.sh --demo
          </code>
        </p>
      </section>
    </div>
  );
}
