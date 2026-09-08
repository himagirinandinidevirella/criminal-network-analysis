import { errorToast } from "@/components/Common/ToastNotification";
/**
 * WhatIfSimulator — simulate removing a criminal from the network.
 */
import { useEffect, useState } from "react";
import { FlaskConical, Loader2 } from "lucide-react";
import { post, get } from "@/services/api";
import type { Criminal } from "@/types/criminal.types";
import type { Paginated } from "@/types/api.types";
import type { WhatIfResult } from "@/types/network.types";

export default function WhatIfSimulator() {
  const [criminalId, setCriminalId] = useState("");
  const [options, setOptions] = useState<Criminal[]>([]);
  const [result, setResult] = useState<WhatIfResult | null>(null);
  const [loading, setLoading] = useState(false);

  const loadOptions = async () => {
    try {
      const res = await get<Paginated<Criminal>>(
        "/api/criminals/?limit=50&sort_by=risk_score",
      );
      setOptions(res.items);
    } catch {
      setOptions([]);
    }
  };

  useEffect(() => {
    loadOptions();
  }, []);

  const simulate = async () => {
    if (!criminalId) return;
    setLoading(true);
    try {
      const res = await post<WhatIfResult>("/api/network/whatif", {
        criminal_id: criminalId,
        action: "ARREST",
      });
      setResult(res);
    } catch {
      errorToast("Could not run the graph simulation");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass rounded-2xl p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <FlaskConical className="h-4 w-4 text-risk-high" /> What-If Simulator
      </h3>
      <p className="mb-3 text-xs text-ink-soft">
        Structural simulation only. Does not change records or predict an
        arrest's outcome.
      </p>
      <div className="space-y-2">
        <select
          value={criminalId}
          onChange={(e) => setCriminalId(e.target.value)}
          className="w-full rounded-lg border border-border bg-bg-tertiary px-2 py-2 text-xs text-text-primary"
          aria-label="Select criminal to simulate arrest"
        >
          <option value="">Remove node: Select person…</option>
          {options.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          onClick={simulate}
          disabled={!criminalId || loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-risk-high py-2 text-xs font-semibold text-white transition hover:bg-risk-high/80 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          SIMULATE
        </button>
      </div>

      {result && (
        <div className="mt-3 space-y-2 rounded-lg bg-bg-tertiary p-3 text-xs">
          <div className="flex justify-between">
            <span className="text-text-muted">Nodes removed</span>
            <span className="font-semibold">{result.impact.nodes_removed}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Edges removed</span>
            <span className="font-semibold">{result.impact.edges_removed}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">
              Change in connected components
            </span>
            <span className="font-semibold text-risk-high">
              {result.impact.community_fragmentation > 0 ? "+" : ""}
              {result.impact.community_fragmentation}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Network state</span>
            <span className="font-semibold">
              {result.impact.network_resilience}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
