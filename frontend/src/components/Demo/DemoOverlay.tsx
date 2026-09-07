/**
 * DemoOverlay — the floating guide shown during the demo tour.
 */
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, SkipForward, X, ShieldCheck } from "lucide-react";
import { useDemo } from "@/hooks/useDemoMode";

export default function DemoOverlay() {
  const { active, stepIndex, paused, steps, togglePause, next, exit } = useDemo();
  const step = steps[stepIndex];
  const progress = ((stepIndex + 1) / steps.length) * 100;

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
        >
          <div className="glass w-full max-w-2xl rounded-2xl p-4">
            {/* Header row */}
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-full bg-seal-soft px-2.5 py-0.5 text-[11px] font-bold text-seal">
                <ShieldCheck className="h-3.5 w-3.5" /> DEMO MODE
              </span>
              <span className="text-[11px] text-text-muted">
                Step {stepIndex + 1} of {steps.length} · {step.title}
              </span>
              <div className="ml-auto flex items-center gap-1">
                <button
                  onClick={togglePause}
                  className="rounded-lg border border-border p-1.5 text-text-secondary transition hover:bg-bg-hover"
                  aria-label={paused ? "Resume demo" : "Pause demo"}
                  title={paused ? "Resume" : "Pause"}
                >
                  {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                </button>
                <button
                  onClick={next}
                  className="flex items-center gap-1 rounded-lg border border-border px-2 py-1.5 text-[11px] font-semibold text-text-secondary transition hover:bg-bg-hover"
                  title="Skip to next step"
                >
                  <SkipForward className="h-3.5 w-3.5" /> Next
                </button>
                <button
                  onClick={exit}
                  className="rounded-lg border border-border p-1.5 text-text-secondary transition hover:bg-risk-critical/20 hover:text-risk-critical"
                  aria-label="Exit demo"
                  title="Exit demo"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Narration */}
            <p className="mt-2 text-sm text-text-secondary">{step.narration}</p>
            <p className="mt-1 text-xs text-text-muted">{step.description}</p>

            {/* Progress bar + step dots */}
            <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-bg-hover">
              <div
                className="h-full rounded-full bg-gradient-to-r from-accent-blue to-accent-cyan transition-all duration-500"
                style={{ width: `${paused ? progress : progress}%` }}
              />
            </div>
            <div className="mt-2 flex justify-center gap-1.5">
              {steps.map((s, i) => (
                <span
                  key={s.id}
                  className={`h-1.5 rounded-full transition-all ${
                    i < stepIndex
                      ? "w-4 bg-accent-blue"
                      : i === stepIndex
                      ? "w-6 bg-accent-cyan"
                      : "w-1.5 bg-bg-hover"
                  }`}
                />
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
