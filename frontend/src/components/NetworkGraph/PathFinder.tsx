/**
 * PathFinder — find the shortest connection path between two criminals.
 */
import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { GitBranch, Loader2 } from "lucide-react";
import { AppDispatch, RootState } from "@/store";
import { findPath } from "@/store/networkSlice";
import { get } from "@/services/api";
import type { Criminal } from "@/types/criminal.types";
import type { Paginated } from "@/types/api.types";

export default function PathFinder() {
  const dispatch = useDispatch<AppDispatch>();
  const path = useSelector((state: RootState) => state.network.path);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [options, setOptions] = useState<Criminal[]>([]);
  const [loading, setLoading] = useState(false);

  // Load a short list of known persons for the dropdowns.
  const loadOptions = async () => {
    try {
      const result = await get<Paginated<Criminal>>("/api/criminals/?limit=50&sort_by=risk_score");
      setOptions(result.items);
    } catch {
      setOptions([]);
    }
  };

  const runPath = () => {
    if (!from || !to) return;
    setLoading(true);
    dispatch(findPath({ from_id: from, to_id: to })).finally(() => setLoading(false));
  };

  return (
    <div className="glass rounded-2xl p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <GitBranch className="h-4 w-4 text-accent-cyan" /> Path Finder
      </h3>

      <div className="space-y-2">
        <select
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          onFocus={loadOptions}
          className="w-full rounded-lg border border-border bg-bg-tertiary px-2 py-2 text-xs text-text-primary"
          aria-label="From criminal"
        >
          <option value="">From: Select criminal…</option>
          {options.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={to}
          onChange={(e) => setTo(e.target.value)}
          onFocus={loadOptions}
          className="w-full rounded-lg border border-border bg-bg-tertiary px-2 py-2 text-xs text-text-primary"
          aria-label="To criminal"
        >
          <option value="">To: Select criminal…</option>
          {options.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <button
          onClick={runPath}
          disabled={!from || !to || loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent-blue py-2 text-xs font-semibold text-white transition hover:bg-seal-dark disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          FIND CONNECTION
        </button>
      </div>

      {path && (
        <div className="mt-3 rounded-lg bg-bg-tertiary p-3 text-xs">
          {path.found ? (
            <>
              <p className="font-semibold text-risk-low">
                Path: {path.nodes.map((n) => n.name).join(" → ")} ({path.hops} hops)
              </p>
              <div className="mt-2 space-y-1 text-text-secondary">
                {path.edges.map((e, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="rounded bg-bg-hover px-1.5 py-0.5 text-[10px]">{e.type}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-risk-medium">No connection path found (within 6 hops).</p>
          )}
        </div>
      )}
    </div>
  );
}
