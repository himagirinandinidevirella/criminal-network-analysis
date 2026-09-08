import { useEffect } from "react";
/**
 * AlertDetailPanel — modal with full alert details.
 */
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import type { Alert } from "@/types/alert.types";
import { formatDateTime } from "@/utils/formatters";

interface Props {
  alert: Alert;
  onClose: () => void;
}

export default function AlertDetailPanel({ alert, onClose }: Props) {
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="glass w-full max-w-md rounded-2xl p-6"
          role="dialog"
          aria-modal="true"
          aria-label={`Alert ${alert.id} details`}
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.92, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">Alert #{alert.id}</h3>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 hover:bg-bg-hover"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <dl className="mt-4 space-y-2 text-sm">
            {[
              ["Title", alert.title],
              ["Severity", alert.severity],
              ["Category", alert.category],
              ["Description", alert.description],
              ["Subject", alert.criminal_name ?? "—"],
              ["Status", alert.status],
              ["Assigned to", alert.assigned_to ?? "—"],
              ["Created", formatDateTime(alert.created_at)],
              ["Source", alert.source],
            ].map(([k, v]) => (
              <div
                key={k}
                className="flex justify-between border-b border-border/50 pb-1"
              >
                <dt className="text-text-muted">{k}</dt>
                <dd className="max-w-[60%] text-right text-text-primary">
                  {v}
                </dd>
              </div>
            ))}
          </dl>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
