import { Shield, ShieldAlert, Loader2, RefreshCw } from "lucide-react";
import type { PersonModelContext } from "@/hooks/usePersonDetection";

interface PersonDetectionControlsProps {
  enabled: boolean;
  model: PersonModelContext;
  threshold: number;
  count: number;
  analysedViews: number;
  onEnabled: (enabled: boolean) => void;
  onThreshold: (threshold: number) => void;
  canLoadSample: boolean;
  onRetry: () => void;
  onSample: () => void;
}

export default function PersonDetectionControls({
  enabled,
  model,
  threshold,
  count,
  analysedViews,
  onEnabled,
  onThreshold,
  onRetry,
}: PersonDetectionControlsProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-paper-line bg-paper-sunk px-4 py-3 sm:px-5">
      <div className="flex items-center gap-4">
        <label className="flex cursor-pointer items-center gap-2">
          <div className="relative">
            <input
              type="checkbox"
              className="peer sr-only"
              checked={enabled}
              onChange={(e) => onEnabled(e.target.checked)}
              aria-label="Enable Person Detection"
            />
            <div className="h-5 w-9 rounded-full bg-paper-line transition peer-checked:bg-teal"></div>
            <div className="absolute left-[2px] top-[2px] h-4 w-4 rounded-full bg-white transition peer-checked:translate-x-full"></div>
          </div>
          <span className="text-sm font-semibold text-ink">
            Person Detection
          </span>
        </label>

        {enabled && model.status === "ready" && (
          <div className="flex items-center gap-2 border-l border-paper-line pl-4">
            <span className="text-xs text-ink-soft">Confidence</span>
            <input
              type="range"
              min="0.3"
              max="0.9"
              step="0.05"
              value={threshold}
              onChange={(e) => onThreshold(parseFloat(e.target.value))}
              className="w-24 accent-teal"
              aria-label="Person detection confidence threshold"
            />
            <span className="w-8 text-xs font-mono text-ink-soft">
              {Math.round(threshold * 100)}%
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        {enabled && model.status === "loading" && (
          <span className="inline-flex items-center gap-1.5 rounded bg-teal-soft px-2 py-1 text-xs font-semibold text-teal">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading model...
          </span>
        )}
        {enabled && model.status === "error" && (
          <div className="flex items-center gap-2 rounded border border-risk-critical/20 bg-risk-critical/5 px-2 py-1 text-xs text-risk-critical">
            <ShieldAlert className="h-3.5 w-3.5" />
            <span>{model.error}</span>
            <button onClick={onRetry} className="ml-1 underline">
              <RefreshCw className="h-3 w-3" />
            </button>
          </div>
        )}
        {enabled && model.status === "ready" && (
          <span className="inline-flex items-center gap-1.5 rounded bg-teal-soft px-2.5 py-1 text-xs font-semibold text-teal">
            <Shield className="h-3.5 w-3.5" />
            {count} {count === 1 ? "person" : "people"} detected in{" "}
            {analysedViews} {analysedViews === 1 ? "view" : "views"}
          </span>
        )}
      </div>
    </div>
  );
}
