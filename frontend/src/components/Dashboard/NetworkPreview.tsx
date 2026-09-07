/**
 * NetworkPreview — an interactive mini network map on the dashboard.
 * Clicking navigates to the full Network Analysis page.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { Network, Maximize2, Loader2 } from "lucide-react";
import { AppDispatch, RootState } from "@/store";
import { fetchFullGraph } from "@/store/networkSlice";
import { useNetworkGraph, registerGraphExtensions } from "@/hooks/useNetworkGraph";
import ErrorState from "@/components/Common/ErrorState";

export default function NetworkPreview() {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const graph = useSelector((state: RootState) => state.network.graph);
  const loading = useSelector((state: RootState) => state.network.loading);
  const containerRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    registerGraphExtensions();
    dispatch(fetchFullGraph({ limit: 120 }))
      .unwrap()
      .catch(() => setFailed(true));
  }, [dispatch]);

  useNetworkGraph(containerRef, {
    graph,
    layout: "cose",
    onNodeClick: () => navigate("/network"),
  });

  return (
    <div className="glass flex flex-col rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Network className="h-4 w-4 text-accent-cyan" /> Network Preview
        </h2>
        <button
          onClick={() => navigate("/network")}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:bg-bg-hover"
        >
          <Maximize2 className="h-3.5 w-3.5" /> Expand
        </button>
      </div>

      <div className="relative h-[360px] overflow-hidden rounded-xl border border-border bg-bg-primary/60">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center text-text-muted">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}
        {failed && !loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <ErrorState
              message="Network unavailable"
              onRetry={() => {
                setFailed(false);
                dispatch(fetchFullGraph({ limit: 120 })).unwrap().catch(() => setFailed(true));
              }}
            />
          </div>
        )}
        <div ref={containerRef} className="cy-container" aria-label="Network preview graph" />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-text-muted">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-risk-critical" /> Critical</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-risk-high" /> High</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-risk-medium" /> Medium</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-risk-low" /> Low</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-accent-blue" /> Organization</span>
        <span className="ml-auto">Click a node to explore</span>
      </div>
    </div>
  );
}
