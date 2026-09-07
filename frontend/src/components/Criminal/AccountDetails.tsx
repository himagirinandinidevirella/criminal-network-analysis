/**
 * AccountDetails — financial accounts linked to a criminal.
 */
import { Landmark } from "lucide-react";
import type { Account } from "@/types/criminal.types";
import { formatCompactINR } from "@/utils/formatters";

interface Props {
  accounts: Account[];
}

export default function AccountDetails({ accounts }: Props) {
  if (accounts.length === 0) {
    return (
      <div className="glass rounded-2xl p-8 text-center text-sm text-text-muted">
        No financial accounts on record.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {accounts.map((a) => (
        <div key={a.id} className="glass rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-bg-tertiary">
              <Landmark className="h-5 w-5 text-accent-blue" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">{a.bank_name ?? "Bank"}</p>
              <p className="font-mono text-xs text-text-secondary">
                {a.account_number} · {a.account_type}
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            {a.flagged && (
              <span className="rounded-full bg-risk-high/15 px-2 py-0.5 font-semibold text-risk-high">
                FLAGGED 🚨
              </span>
            )}
            {a.frozen && (
              <span className="rounded-full bg-accent-cyan/15 px-2 py-0.5 font-semibold text-accent-cyan">
                FROZEN ❄️
              </span>
            )}
            {a.total_suspicious_amount > 0 && (
              <span className="ml-auto font-semibold text-risk-critical">
                {formatCompactINR(a.total_suspicious_amount)} suspicious
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
