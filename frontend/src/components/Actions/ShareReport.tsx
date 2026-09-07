/**
 * ShareReport — generate a secure, expiring share link.
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Copy } from "lucide-react";
import { post } from "@/services/api";
import { successToast, errorToast } from "@/components/Common/ToastNotification";

interface Props {
  criminalId: string;
  onClose: () => void;
}

export default function ShareReport({ criminalId, onClose }: Props) {
  const [expiry, setExpiry] = useState(24);
  const [access, setAccess] = useState("VIEW");
  const [shareUrl, setShareUrl] = useState("");

  const create = async () => {
    try {
      const form = new FormData();
      form.append("report_id", criminalId);
      form.append("expiry_hours", String(expiry));
      form.append("access_level", access);
      const res = await post<{ share_url: string }>("/api/actions/share", form);
      setShareUrl(res.share_url);
      successToast("Share link created");
    } catch {
      errorToast("Could not create share link");
    }
  };

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
          initial={{ scale: 0.92 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0.92 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-bold">Share Report</h3>
            <button onClick={onClose} aria-label="Close"><X className="h-4 w-4" /></button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-text-secondary">Expiry</label>
              <select
                value={expiry}
                onChange={(e) => setExpiry(Number(e.target.value))}
                className="w-full rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-sm"
              >
                <option value={24}>24 hours</option>
                <option value={168}>7 days</option>
                <option value={720}>30 days</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-text-secondary">Access level</label>
              <select
                value={access}
                onChange={(e) => setAccess(e.target.value)}
                className="w-full rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-sm"
              >
                <option value="VIEW">View only</option>
                <option value="DOWNLOAD">View + Download</option>
              </select>
            </div>

            <button
              onClick={create}
              className="w-full rounded-lg bg-accent-blue py-2.5 text-sm font-semibold text-white transition hover:bg-seal-dark"
            >
              Generate secure link
            </button>

            {shareUrl && (
              <div className="flex items-center gap-2 rounded-lg bg-bg-tertiary p-2">
                <code className="flex-1 truncate text-xs text-accent-cyan">{shareUrl}</code>
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(shareUrl);
                    successToast("Copied to clipboard");
                  }}
                  aria-label="Copy link"
                >
                  <Copy className="h-4 w-4 text-text-muted" />
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
