/**
 * ErrorState — an error panel with a retry action.
 */
import { AlertTriangle, RotateCcw } from "lucide-react";

interface Props {
  message?: string;
  onRetry?: () => void;
}

export default function ErrorState({
  message = "Something went wrong.",
  onRetry,
}: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-risk-critical/40 bg-risk-critical/5 p-8 text-center">
      <AlertTriangle className="h-8 w-8 text-risk-critical" />
      <p className="text-sm text-text-secondary">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-lg bg-accent-blue px-4 py-2 text-sm font-semibold text-white transition hover:bg-seal-dark"
        >
          <RotateCcw className="h-4 w-4" /> Retry
        </button>
      )}
    </div>
  );
}
