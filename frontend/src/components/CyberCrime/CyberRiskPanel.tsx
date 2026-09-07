/**
 * CyberRiskPanel — per-criminal cyber risk assessment + network-wide threat
 * leaderboard (ransomware, phishing, crypto laundering, dark web, coordinated
 * attacks, social engineering).
 */
import { useState } from "react";
import { ShieldAlert, Search, AlertTriangle } from "lucide-react";
import { detectCriminalCyber, getCyberThreats } from "@/services/blockchainService";
import { errorToast } from "@/components/Common/ToastNotification";
import { riskTextClass } from "@/utils/riskUtils";
import type { CyberDetection, CyberThreatRow } from "@/types/blockchain.types";

export default function CyberRiskPanel() {
  const [criminalId, setCriminalId] = useState("");
  const [detection, setDetection] = useState<CyberDetection | null>(null);
  const [threats, setThreats] = useState<CyberThreatRow[]>([]);
  const [busy, setBusy] = useState(false);

  const assess = async () => {
    if (!criminalId.trim()) return;
    setBusy(true);
    try {
      setDetection(await detectCriminalCyber(criminalId.trim()));
    } catch {
      errorToast("Assessment failed (criminal not found?)");
    } finally {
      setBusy(false);
    }
  };

  const loadThreats = async () => {
    setBusy(true);
    try {
      const res = await getCyberThreats(50);
      setThreats(res.threats);
    } catch {
      errorToast("Unable to load cyber threats");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="glass rounded-2xl p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-accent-cyan" />
          <h3 className="text-sm font-semibold">Cyber Risk Assessment</h3>
        </div>
        <button
          onClick={loadThreats}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs text-text-secondary transition hover:bg-bg-hover disabled:opacity-50"
        >
          <AlertTriangle className="h-3.5 w-3.5" /> Network threats
        </button>
      </div>

      <div className="mb-3 flex gap-2">
        <input
          value={criminalId}
          onChange={(e) => setCriminalId(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && assess()}
          placeholder="Criminal ID to assess"
          className="flex-1 rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-blue focus:outline-none"
        />
        <button
          onClick={assess}
          disabled={busy || !criminalId.trim()}
          className="flex items-center gap-1.5 rounded-lg bg-accent-blue px-4 py-2 text-sm font-semibold text-white transition hover:bg-seal-dark disabled:opacity-50"
        >
          <Search className="h-4 w-4" /> Assess
        </button>
      </div>

      {detection && (
        <div className="mb-4 rounded-xl border border-border bg-bg-tertiary/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-bold text-text-primary">{detection.name ?? detection.criminal_id}</span>
            <span className={`text-2xl font-bold ${riskTextClass(detection.cyber_risk_level)}`}>
              {detection.cyber_risk_score}
              <span className="text-xs text-text-muted">/100 · {detection.cyber_risk_level}</span>
            </span>
          </div>
          <p className="mt-1 text-xs text-text-secondary">{detection.summary}</p>
          {detection.detected_threats.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {detection.detected_threats.map((t) => (
                <span
                  key={t.label}
                  className="rounded-full border border-risk-critical/40 bg-risk-critical/10 px-2 py-0.5 text-[10px] text-risk-critical"
                >
                  {t.label} · {t.score}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {threats.length > 0 && (
        <ul className="space-y-1.5">
          {threats.slice(0, 12).map((t) => (
            <li key={t.criminal_id} className="flex items-center gap-3 rounded-lg border border-border/60 bg-bg-tertiary/50 px-3 py-2 text-xs">
              <span className={`h-2 w-2 shrink-0 rounded-full ${riskTextClass(t.cyber_risk_level).replace("text-", "bg-")}`} />
              <span className="w-40 truncate font-semibold text-text-primary">{t.name}</span>
              <span className="flex flex-wrap gap-1 text-[10px] text-text-muted">
                {t.top_threats.map((th) => (
                  <span key={th} className="rounded bg-bg-hover px-1.5 py-0.5">{th}</span>
                ))}
              </span>
              <span className={`ml-auto font-bold ${riskTextClass(t.cyber_risk_level)}`}>{t.cyber_risk_score}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
