/**
 * CyberThreatScanner — analyse evidence text for cyber-crime signals and run
 * heuristic URL / crypto-wallet scans.
 */
import { useState } from "react";
import { Radar, Globe, Wallet, ScanLine } from "lucide-react";
import { analyzeCyberEvidence, scanUrl, scanWallet } from "@/services/blockchainService";
import { errorToast } from "@/components/Common/ToastNotification";
import { riskTextClass } from "@/utils/riskUtils";
import type {
  CyberDetection, UrlScanResult, WalletScanResult,
} from "@/types/blockchain.types";

type ScanTab = "text" | "url" | "wallet";

export default function CyberThreatScanner() {
  const [tab, setTab] = useState<ScanTab>("text");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [address, setAddress] = useState("");
  const [detection, setDetection] = useState<CyberDetection | null>(null);
  const [urlResult, setUrlResult] = useState<UrlScanResult | null>(null);
  const [walletResult, setWalletResult] = useState<WalletScanResult | null>(null);
  const [busy, setBusy] = useState(false);

  const analyze = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      setDetection(await analyzeCyberEvidence({ text }));
    } catch {
      errorToast("Analysis failed");
    } finally {
      setBusy(false);
    }
  };

  const scan = async () => {
    setBusy(true);
    try {
      if (tab === "url") setUrlResult(await scanUrl(url));
      else setWalletResult(await scanWallet(address));
    } catch {
      errorToast("Scan failed");
    } finally {
      setBusy(false);
    }
  };

  const tabs: Array<{ id: ScanTab; label: string; icon: typeof Radar }> = [
    { id: "text", label: "Evidence text", icon: Radar },
    { id: "url", label: "URL scan", icon: Globe },
    { id: "wallet", label: "Wallet scan", icon: Wallet },
  ];

  return (
    <div className="glass rounded-2xl p-5">
      <div className="mb-4 flex items-center gap-2">
        <ScanLine className="h-5 w-5 text-accent-cyan" />
        <h3 className="text-sm font-semibold">Cyber Threat Scanner</h3>
      </div>

      <div className="mb-3 flex gap-1 rounded-md border border-paper-line bg-paper-sunk p-1">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium transition ${
              tab === id ? "bg-paper-raised text-ink shadow-sm" : "text-ink-faint hover:text-ink"
            }`}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>

      {tab === "text" && (
        <>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            placeholder="Paste chat logs, ransom notes, forum posts, FIR excerpts, wallet addresses…"
            className="mb-3 w-full rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-blue focus:outline-none"
          />
          <button
            onClick={analyze}
            disabled={busy || !text.trim()}
            className="rounded-lg bg-accent-blue px-4 py-2 text-sm font-semibold text-white transition hover:bg-seal-dark disabled:opacity-50"
          >
            {busy ? "Analysing…" : "Analyse"}
          </button>
        </>
      )}

      {tab === "url" && (
        <div className="mb-3 flex gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://suspicious-link.example/verify"
            className="flex-1 rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-blue focus:outline-none"
          />
          <button
            onClick={scan}
            disabled={busy || !url.trim()}
            className="rounded-lg bg-accent-blue px-4 py-2 text-sm font-semibold text-white transition hover:bg-seal-dark disabled:opacity-50"
          >
            Scan
          </button>
        </div>
      )}

      {tab === "wallet" && (
        <div className="mb-3 flex gap-2">
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="bc1q… / 0x… / 4…"
            className="flex-1 rounded-lg border border-border bg-bg-tertiary px-3 py-2 font-mono text-sm text-text-primary placeholder:text-text-muted focus:border-accent-blue focus:outline-none"
          />
          <button
            onClick={scan}
            disabled={busy || !address.trim()}
            className="rounded-lg bg-accent-blue px-4 py-2 text-sm font-semibold text-white transition hover:bg-seal-dark disabled:opacity-50"
          >
            Scan
          </button>
        </div>
      )}

      {/* Results */}
      {detection && (
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-border bg-bg-tertiary/60 p-3">
            <span className="text-sm font-semibold">Cyber risk score</span>
            <span className={`text-2xl font-bold ${riskTextClass(detection.cyber_risk_level)}`}>
              {detection.cyber_risk_score}
              <span className="text-xs text-text-muted">/100 · {detection.cyber_risk_level}</span>
            </span>
          </div>
          <p className="text-xs text-text-secondary">{detection.summary}</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Object.values(detection.categories).map((c) => (
              <div
                key={c.label}
                className={`rounded-lg border p-2 text-xs ${
                  c.detected ? "border-risk-critical/50 bg-risk-critical/10" : "border-border bg-bg-tertiary/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-text-primary">{c.label}</span>
                  <span className={c.detected ? "text-risk-critical" : "text-risk-low"}>
                    {c.detected ? "DETECTED" : "clear"}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-bg-hover">
                  <div
                    className={`h-full rounded-full ${c.detected ? "bg-risk-critical" : "bg-risk-low"}`}
                    style={{ width: `${c.score}%` }}
                  />
                </div>
                <div className="mt-1 text-text-muted">{c.score}/100 · {c.indicator_count} indicators</div>
              </div>
            ))}
          </div>
          {detection.recommendations.length > 0 && (
            <ul className="space-y-1 rounded-lg bg-bg-tertiary/50 p-3 text-xs text-text-secondary">
              {detection.recommendations.map((r, i) => (
                <li key={i}>• {r}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {urlResult && (
        <div className="rounded-xl border border-border bg-bg-tertiary/60 p-3 text-xs">
          <div className="mb-1 flex items-center justify-between">
            <span className="font-mono text-text-primary">{urlResult.host}</span>
            <span className={`font-bold ${riskTextClass(urlResult.threat_level)}`}>
              {urlResult.threat_score}/100 · {urlResult.verdict}
            </span>
          </div>
          <ul className="space-y-0.5 text-text-secondary">
            {urlResult.flags.map((f) => <li key={f}>• {f}</li>)}
          </ul>
        </div>
      )}

      {walletResult && (
        <div className="rounded-xl border border-border bg-bg-tertiary/60 p-3 text-xs">
          <div className="mb-1 flex items-center justify-between">
            <span className="font-mono text-text-primary">
              {walletResult.address.slice(0, 18)}… ({walletResult.currency})
            </span>
            <span className={`font-bold ${riskTextClass(walletResult.threat_level)}`}>
              {walletResult.threat_score}/100 · {walletResult.verdict}
            </span>
          </div>
          <ul className="space-y-0.5 text-text-secondary">
            {walletResult.flags.map((f) => <li key={f}>• {f}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
