/**
 * BlockchainStatusCard — live network status + immutable-ledger statistics.
 */
import { useEffect, useState } from "react";
import { Activity, Boxes, FileCheck2, ScrollText, ShieldCheck, Database, WifiOff } from "lucide-react";
import { getBlockchainStatus } from "@/services/blockchainService";
import type { BlockchainStatus, LedgerStats } from "@/types/blockchain.types";
import LoadingSkeleton from "@/components/Common/LoadingSkeleton";

export default function BlockchainStatusCard() {
  const [status, setStatus] = useState<BlockchainStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getBlockchainStatus()
      .then(setStatus)
      .catch(() => setError("Blockchain status unavailable"));
  }, []);

  if (error) {
    return (
      <div className="glass rounded-2xl p-5">
        <p className="text-sm text-text-secondary">{error}</p>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="glass rounded-2xl p-5">
        <LoadingSkeleton lines={4} />
      </div>
    );
  }

  const online = status.mode === "web3";
  const stats: Array<{ label: string; value: number; icon: typeof Boxes }> = [
    { label: "Evidence on-chain", value: status.stats.total_evidence, icon: FileCheck2 },
    { label: "Audit entries", value: status.stats.total_audit, icon: ScrollText },
    { label: "Criminal records", value: status.stats.total_records, icon: Database },
    { label: "Report certificates", value: status.stats.total_reports, icon: ShieldCheck },
    { label: "Shared permissions", value: status.stats.total_shares, icon: Activity },
  ];

  return (
    <div className="glass rounded-2xl p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Blockchain Ledger</h3>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold ${
            online
              ? "border-risk-low/40 bg-risk-low/10 text-risk-low"
              : "border-risk-medium/40 bg-risk-medium/10 text-risk-medium"
          }`}
        >
          {online ? <Activity className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
          {online ? "Live node" : "Local ledger"}
        </span>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
        <div className="rounded-lg bg-bg-tertiary p-2">
          <div className="text-text-muted">Network</div>
          <div className="truncate font-semibold text-text-primary">{status.network.network}</div>
        </div>
        <div className="rounded-lg bg-bg-tertiary p-2">
          <div className="text-text-muted">Chain ID</div>
          <div className="font-semibold text-text-primary">{status.network.chain_id}</div>
        </div>
        <div className="rounded-lg bg-bg-tertiary p-2">
          <div className="text-text-muted">Block height</div>
          <div className="font-semibold text-text-primary">#{status.network.block_number}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {stats.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-xl border border-border bg-bg-tertiary/60 p-3 text-center">
            <Icon className="mx-auto mb-1.5 h-5 w-5 text-accent-cyan" />
            <div className="text-xl font-bold text-text-primary">{value}</div>
            <div className="text-[10px] text-text-muted">{label}</div>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs leading-relaxed text-text-muted">{status.note}</p>
    </div>
  );
}
