import { Scan, Loader2, AlertTriangle, PlayCircle } from "lucide-react";
import type { FaceModelState } from "@/types/faceDetection.types";

interface Props {
  enabled: boolean;
  canLoadSample: boolean;
  model: FaceModelState;
  threshold: number;
  count: number;
  analysedViews: number;
  onEnabled: (value: boolean) => void;
  onThreshold: (value: number) => void;
  onRetry: () => void;
  onSample: () => void;
}
export default function FaceDetectionControls({
  enabled,
  canLoadSample,
  model,
  threshold,
  count,
  analysedViews,
  onEnabled,
  onThreshold,
  onRetry,
  onSample,
}: Props) {
  return (
    <div className="border-b border-paper-line bg-teal-soft/40 px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-teal">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onEnabled(e.target.checked)}
            className="h-4 w-4 accent-teal"
          />
          <Scan className="h-4 w-4" />
          Enable AI face detection
        </label>
        <button
          type="button"
          onClick={onSample}
          disabled={!canLoadSample}
          className="inline-flex items-center gap-1.5 rounded-lg border border-teal/30 disabled:opacity-50 bg-paper-raised px-3 py-2 text-xs font-semibold text-teal hover:bg-teal-soft"
        >
          <PlayCircle className="h-4 w-4" />
          Try AI test clip
        </button>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-ink-soft">
        Tiny Face Detector runs on your device. It draws face boxes and
        confidence scores—not names, criminal matches, face templates or
        cross-camera identities. Results can miss faces or produce false
        positives, especially with side angles, small faces or poor lighting.
      </p>
      {enabled && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div role="status" className="text-xs text-teal">
            {model.status === "loading" && (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading local face detector…
              </span>
            )}
            {model.status === "ready" && (
              <>
                <span className="font-semibold">
                  Face detector ready · {model.backend?.toUpperCase()}
                </span>
                <span className="ml-2" data-testid="face-total">
                  {count} face {count === 1 ? "detection" : "detections"} across{" "}
                  {analysedViews} analysed{" "}
                  {analysedViews === 1 ? "view" : "views"}
                </span>
              </>
            )}
            {model.status === "error" && (
              <span className="inline-flex flex-wrap items-center gap-2 text-risk-critical">
                <AlertTriangle className="h-4 w-4" />
                {model.error}
                <button onClick={onRetry} className="font-semibold underline">
                  Retry face detector
                </button>
              </span>
            )}
          </div>
          <label className="flex items-center gap-2 text-xs text-ink-soft">
            Minimum confidence
            <input
              type="range"
              min="0.3"
              max="0.95"
              step="0.05"
              value={threshold}
              onChange={(e) => onThreshold(Number(e.target.value))}
              className="w-24 accent-teal"
            />
            <span className="w-8 font-mono">
              {Math.round(threshold * 100)}%
            </span>
          </label>
        </div>
      )}
      {enabled && (
        <p className="mt-2 text-[10px] text-ink-soft">
          Detection pauses for hidden or off-screen videos. Counts are per
          analysed frame, not unique people. Independent recordings are not
          time-synchronised. Detection boxes stay in memory and are cleared when
          detection stops or a recording is closed.
        </p>
      )}
    </div>
  );
}
