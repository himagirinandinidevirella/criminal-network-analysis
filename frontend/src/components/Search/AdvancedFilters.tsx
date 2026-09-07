/**
 * AdvancedFilters — optional filter chips for search.
 */
import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";

interface Props {
  onApply: (filters: Record<string, unknown>) => void;
}

export default function AdvancedFilters({ onApply }: Props) {
  const [open, setOpen] = useState(false);
  const [riskLevel, setRiskLevel] = useState("");
  const [crimeType, setCrimeType] = useState("");
  const [status, setStatus] = useState("");

  const apply = () => {
    onApply({ risk_level: riskLevel, crime_type: crimeType, status });
  };

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:bg-bg-hover"
      >
        <SlidersHorizontal className="h-3.5 w-3.5" /> Advanced Filters
      </button>
      {open && (
        <div className="mt-2 flex flex-wrap gap-2">
          <select
            value={riskLevel}
            onChange={(e) => setRiskLevel(e.target.value)}
            className="rounded-lg border border-border bg-bg-tertiary px-2 py-1.5 text-xs text-text-primary"
            aria-label="Risk level"
          >
            <option value="">Risk: All</option>
            {["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <select
            value={crimeType}
            onChange={(e) => setCrimeType(e.target.value)}
            className="rounded-lg border border-border bg-bg-tertiary px-2 py-1.5 text-xs text-text-primary"
            aria-label="Crime type"
          >
            <option value="">Crime: All</option>
            {["Drug Trafficking", "Money Laundering", "Cyber Crime", "Extortion"].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border border-border bg-bg-tertiary px-2 py-1.5 text-xs text-text-primary"
            aria-label="Status"
          >
            <option value="">Status: All</option>
            {["WANTED", "ARRESTED", "CONVICTED", "UNDER_INVESTIGATION"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button
            onClick={apply}
            className="rounded-lg bg-accent-blue px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-seal-dark"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}
