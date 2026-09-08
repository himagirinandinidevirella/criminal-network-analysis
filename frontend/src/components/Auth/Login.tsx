import { IS_DEMO } from "@/config/runtime";
/**
 * Login — secure access screen.
 * "Classified dossier" layout: ink briefing panel + paper access form.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { motion } from "framer-motion";
import {
  Shield,
  Eye,
  EyeOff,
  Building2,
  Loader2,
  FileText,
  Lock,
  PlayCircle,
  GitBranch,
  BrainCircuit,
  Fingerprint,
} from "lucide-react";
import { loginThunk } from "@/store/authSlice";
import { RootState, type AppDispatch } from "@/store";
import { useDemo } from "@/hooks/useDemoMode";

const DEPARTMENTS = [
  "Mumbai Police",
  "Delhi Police",
  "CBI",
  "NIA",
  "Maharashtra Police",
  "Ministry of Home Affairs",
  "State Intelligence",
];

const PILLARS = [
  {
    icon: GitBranch,
    title: "Graph intelligence",
    text: "12 relationship types across persons, accounts, vehicles and crime events.",
  },
  {
    icon: BrainCircuit,
    title: IS_DEMO ? "Explore sample risk" : "Predictive risk",
    text: IS_DEMO
      ? "Illustrative scores and local graph analysis — no real predictions."
      : "AI risk scoring, anomaly detection and next-move forecasting.",
  },
  {
    icon: Fingerprint,
    title: IS_DEMO ? "Content integrity" : "Immutable evidence",
    text: IS_DEMO
      ? "Try real SHA-256 checksums without a blockchain connection."
      : "Blockchain-sealed audit trail every evaluator can verify.",
  },
];

export default function Login() {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { startDemo } = useDemo();
  const loading = useSelector((state: RootState) => state.auth.loading);
  const error = useSelector((state: RootState) => state.auth.error);

  const [badgeId, setBadgeId] = useState("");
  const [password, setPassword] = useState("");
  const [department, setDepartment] = useState(DEPARTMENTS[0]);
  const [showPassword, setShowPassword] = useState(false);
  const [shake, setShake] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await dispatch(
      loginThunk({ badge_id: badgeId, password, department }),
    );
    if (loginThunk.fulfilled.match(result)) {
      navigate("/");
    } else {
      setShake(true);
      setTimeout(() => setShake(false), 450);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* ── Left: briefing panel ─────────────────────────────── */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-[#1B2530] p-12 text-paper lg:flex">
        <div className="paper-grain absolute inset-0 opacity-30" />

        <div className="relative">
          <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-paper/60">
            {IS_DEMO
              ? "CrimeNet · Interactive project demo"
              : "Ministry of Home Affairs · Government of India"}
          </div>
        </div>

        <div className="relative max-w-lg">
          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="dossier-title text-4xl font-bold leading-tight text-paper xl:text-5xl"
          >
            Criminal networks,
            <br />
            mapped in minutes —
            <br />
            <span className="text-[#E2705C]">not months.</span>
          </motion.h1>
          <p className="mt-6 max-w-md text-[15px] leading-relaxed text-paper/70">
            CrimeNet AI turns scattered FIRs, call records, financial trails and
            seized devices into one living graph — so investigators see the
            whole network, not just the suspect in front of them.
          </p>

          <div className="mt-10 space-y-5">
            {PILLARS.map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-paper/15 bg-paper/5 text-[#E2705C]">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-mono text-sm font-semibold uppercase tracking-wide text-paper">
                    {title}
                  </div>
                  <div className="mt-0.5 text-sm text-paper/60">{text}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative font-mono text-[11px] uppercase tracking-[0.2em] text-paper/40">
          {IS_DEMO
            ? "Fictional data · No affiliation or official access implied"
            : "Authorised personnel only · All access logged & monitored"}
        </div>
      </div>

      {/* ── Right: access form ──────────────────────────────── */}
      <div className="relative flex items-center justify-center bg-paper p-6 paper-grain">
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35 }}
          className={`w-full max-w-md rounded-lg border border-paper-line bg-paper-raised shadow-card-lg ${
            shake ? "animate-shake" : ""
          }`}
        >
          {/* Card header strip */}
          <div className="flex items-center justify-between border-b border-paper-line px-7 py-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
              {IS_DEMO
                ? "Local workspace · No backend needed"
                : "Secure access · Form 204-A"}
            </span>
            <span className="stamp">{IS_DEMO ? "Demo" : "Restricted"}</span>
          </div>

          <div className="p-7">
            {/* Brand */}
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-seal text-paper-raised">
                <Shield className="h-6 w-6" />
              </div>
              <div>
                <h1 className="dossier-title text-2xl font-bold tracking-tight">
                  CrimeNet
                </h1>
                <p className="font-mono text-[10px] uppercase tracking-widest text-ink-faint">
                  Criminal Network Intelligence
                </p>
              </div>
            </div>

            {IS_DEMO && (
              <div className="mb-5 rounded-lg border border-teal/25 bg-teal-soft p-4">
                <p className="text-sm font-semibold text-teal">
                  Explore the complete demo
                </p>
                <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                  Synthetic records only. Everything stays in this browser. No
                  real AI, banking or blockchain connection.
                </p>
                <button
                  type="button"
                  disabled={loading}
                  onClick={async () => {
                    const result = await dispatch(
                      loginThunk({
                        badge_id: "admin@crimenet.gov.in",
                        password: "Admin@123",
                        department: "Demo workspace",
                      }),
                    );
                    if (loginThunk.fulfilled.match(result)) navigate("/");
                  }}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-md bg-teal py-2.5 text-sm font-semibold text-white transition hover:bg-teal-dark disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <PlayCircle className="h-4 w-4" />
                  )}{" "}
                  Explore demo
                </button>
                <details className="mt-3 text-xs text-ink-soft">
                  <summary className="cursor-pointer">
                    Or sign in with a demo account
                  </summary>
                  <p className="mt-2 break-words font-mono">
                    admin@crimenet.gov.in
                    <br />
                    Password: Admin@123
                  </p>
                </details>
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="badge"
                  className="mb-1 block font-mono text-[11px] font-medium uppercase tracking-wide text-ink-soft"
                >
                  Badge / Employee ID
                </label>
                <input
                  id="badge"
                  type="text"
                  value={badgeId}
                  onChange={(e) => setBadgeId(e.target.value)}
                  required
                  placeholder="admin@crimenet.gov.in"
                  className="w-full rounded-md border border-paper-line bg-paper-sunk px-3 py-2.5 font-mono text-sm text-ink placeholder-ink-faint transition focus:border-seal focus:outline-none focus:ring-1 focus:ring-seal"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-1 block font-mono text-[11px] font-medium uppercase tracking-wide text-ink-soft"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="w-full rounded-md border border-paper-line bg-paper-sunk px-3 py-2.5 pr-10 font-mono text-sm text-ink placeholder-ink-faint transition focus:border-seal focus:outline-none focus:ring-1 focus:ring-seal"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="department"
                  className="mb-1 block font-mono text-[11px] font-medium uppercase tracking-wide text-ink-soft"
                >
                  Department
                </label>
                <div className="relative">
                  <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
                  <select
                    id="department"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full appearance-none rounded-md border border-paper-line bg-paper-sunk px-3 py-2.5 pl-9 text-sm text-ink transition focus:border-seal focus:outline-none focus:ring-1 focus:ring-seal"
                  >
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {error && (
                <p className="rounded-md border border-risk-critical/30 bg-risk-critical/10 px-3 py-2 font-mono text-xs text-risk-critical">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-seal py-2.5 text-sm font-semibold text-ink-onred transition hover:bg-seal-dark disabled:opacity-60"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Lock className="h-4 w-4" />
                )}
                SECURE LOGIN
              </button>
            </form>

            <div className="my-5 flex items-center gap-3">
              <div className="file-rule flex-1" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-ink-faint">
                or
              </span>
              <div className="file-rule flex-1" />
            </div>

            {/* Demo mode guided tour */}
            <button
              onClick={startDemo}
              disabled={loading}
              className="mb-3 flex w-full items-center justify-center gap-2 rounded-md border border-teal/40 bg-teal-soft py-2.5 text-sm font-semibold text-teal transition hover:bg-teal/10"
            >
              <PlayCircle className="h-4 w-4" />
              {IS_DEMO
                ? "Start guided walkthrough"
                : "DEMO MODE — 5-minute guided tour"}
            </button>

            {/* Public reports */}
            <button
              onClick={() => navigate("/public")}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-paper-line py-2.5 text-sm font-medium text-ink-soft transition hover:bg-paper-sunk"
            >
              <FileText className="h-4 w-4" />
              View Public Reports (No login required)
            </button>

            <p className="mt-4 text-center font-mono text-[10px] uppercase tracking-wide text-ink-faint">
              {IS_DEMO
                ? "Do not enter real case or personal data"
                : "Authorised personnel only — all access logged"}
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
