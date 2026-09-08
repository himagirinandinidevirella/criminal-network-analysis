/**
 * CriminalNetworkMap — the main Cytoscape network graph with controls bar.
 */
import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { Core } from "cytoscape";
import type { GraphData } from "@/types/network.types";
import { useNetworkGraph } from "@/hooks/useNetworkGraph";
import GraphControls from "./GraphControls";
import ErrorState from "@/components/Common/ErrorState";

interface Props {
  graph: GraphData | null;
  selectedNodeId?: string | null;
  loading?: boolean;
  onNodeSelect: (id: string | null) => void;
  onFilterChange?: (filters: Record<string, unknown>) => void;
}

const CRIME_TYPES = [
  "Drug Trafficking",
  "Money Laundering",
  "Cyber Crime",
  "Extortion",
  "Robbery",
];
const RISK_LEVELS = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const LAYOUTS = ["cose", "dagre", "circle", "grid", "concentric"];

export default function CriminalNetworkMap({
  graph,
  selectedNodeId,
  loading = false,
  onNodeSelect,
  onFilterChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState("cose");
  const [crimeFilter, setCrimeFilter] = useState("");
  const [riskFilter, setRiskFilter] = useState("");

  const cyRef = useNetworkGraph(containerRef, {
    graph,
    layout,
    selectedNodeId,
    onNodeClick: (id) => onNodeSelect(id),
    onNodeDblClick: (id) => onNodeSelect(id),
    onEdgeClick: (_s, _t) => {},
  });

  const runLayout = (name: string) => {
    setLayout(name);
  };

  const handleFilter = (key: string, value: string) => {
    if (key === "crime_type") setCrimeFilter(value);
    if (key === "risk_level") setRiskFilter(value);
    onNodeSelect(null);
    onFilterChange?.({ [key]: value });
  };

  const zoom = (factor: number) => {
    cyRef.current?.zoom(cyRef.current.zoom() * factor);
  };

  const fit = () => cyRef.current?.fit(undefined, 40);
  const reset = () => {
    runLayout("cose");
    setCrimeFilter("");
    setRiskFilter("");
    onFilterChange?.({ crime_type: "", risk_level: "" });
    onNodeSelect(null);
    cyRef.current?.fit(undefined, 30);
  };
  const screenshot = () => {
    const png = cyRef.current?.png({ bg: "#F5F1E8", full: true });
    if (png) {
      const a = document.createElement("a");
      a.href = png;
      a.download = "criminal-network.png";
      a.click();
    }
  };

  return (
    <div className="glass flex flex-col rounded-2xl">
      {/* Controls bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <select
          value={crimeFilter}
          onChange={(e) => handleFilter("crime_type", e.target.value)}
          className="rounded-lg border border-border bg-bg-tertiary px-2 py-1.5 text-xs text-text-primary"
          aria-label="Filter by crime type"
        >
          <option value="">Crime: All</option>
          {CRIME_TYPES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={riskFilter}
          onChange={(e) => handleFilter("risk_level", e.target.value)}
          className="rounded-lg border border-border bg-bg-tertiary px-2 py-1.5 text-xs text-text-primary"
          aria-label="Filter by risk level"
        >
          <option value="">Risk: All</option>
          {RISK_LEVELS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select
          value={layout}
          onChange={(e) => runLayout(e.target.value)}
          className="rounded-lg border border-border bg-bg-tertiary px-2 py-1.5 text-xs text-text-primary"
          aria-label="Graph layout"
        >
          {LAYOUTS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        <select
          aria-label="Inspect entity"
          value={selectedNodeId ?? ""}
          onChange={(e) => onNodeSelect(e.target.value || null)}
          className="min-w-0 max-w-[220px] rounded-lg border border-border bg-bg-tertiary px-2 py-1.5 text-xs"
        >
          <option value="">Inspect entity…</option>
          {graph?.nodes.map((n) => (
            <option key={n.data.id} value={n.data.id}>
              {String(n.data.name)} ({n.data.label})
            </option>
          ))}
        </select>
        <GraphControls
          onZoomIn={() => zoom(1.2)}
          onZoomOut={() => zoom(0.8)}
          onFit={fit}
          onReset={reset}
          onScreenshot={screenshot}
        />
      </div>

      {/* Canvas */}
      <div className="relative h-[560px] overflow-hidden rounded-b-2xl bg-bg-primary/60">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-bg-primary/40 text-text-muted">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}
        {graph?.nodes.length === 0 && !loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-paper/90 p-6 text-center text-sm text-ink-soft">
            No entities match these filters. Reset the view to see the full
            graph.
          </div>
        )}
        {!graph && !loading && (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <ErrorState
              message="Unable to load the network graph"
              onRetry={() => onFilterChange?.({})}
            />
          </div>
        )}
        <div
          ref={containerRef}
          className="cy-container"
          aria-label="Criminal network graph"
        />
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 border-t border-border px-4 py-2 text-[11px] text-text-muted">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-risk-critical" /> Critical
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-risk-high" /> High
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-risk-medium" /> Medium
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-risk-low" /> Low
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rotate-45 bg-[#22303E]" /> Organization
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-[#17645B]" /> Location
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-[#8A6D3B]" /> Vehicle
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-[#5B6B7A]" /> Account
        </span>
        <span className="ml-auto">
          {graph
            ? `${graph.nodes.length} nodes · ${graph.edges.length} edges · `
            : ""}
          Size = relative degree · Click = details
        </span>
      </div>
    </div>
  );
}

// Re-declare Core type usage for layout options (keeps types local).
type _Unused = Core;
