import { IS_DEMO } from "@/config/runtime";
/**
 * ShareReport — generate a secure, expiring share link.
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Copy } from "lucide-react";
import { postForm } from "@/services/api";
import {
  successToast,
  errorToast,
} from "@/components/Common/ToastNotification";

interface Props {
  criminalId: string;
  onClose: () => void;
}

export default function ShareReport({ criminalId, onClose }: Props) {
  const [expiry, setExpiry] = useState(24);
  const [access, setAccess] = useState("VIEW");
  const [shareUrl, setShareUrl] = useState("");
  const [creating, setCreating] = useState(false);

  const create = async () => {
    setCreating(true);
    try {
      const form = new FormData();
      form.append("report_id", criminalId);
      form.append("expiry_hours", String(expiry));
      form.append("access_level", access);
      const res = await postForm<{ share_url: string }>(
        "/api/actions/share",
        form,
      );
      setShareUrl(res.share_url);
      successToast("Share link created");
    } catch {
      errorToast("Could not create share link");
    } finally {
      setCreating(false);
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
            <button onClick={onClose} aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>

          {IS_DEMO && (
            <p className="mb-4 rounded-lg bg-teal-soft p-3 text-xs text-teal">
              Local preview only. This snapshot link works in this browser, not
              on other devices. It is not a secure public sharing service.
              Export a report file to share the demo externally.
            </p>
          )}
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-text-secondary">
                Expiry
              </label>
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
              <label className="mb-1 block text-xs text-text-secondary">
                Access level
              </label>
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
              disabled={creating}
              className="w-full rounded-lg bg-accent-blue py-2.5 text-sm font-semibold text-white transition hover:bg-seal-dark"
            >
              {creating
                ? "Creating…"
                : IS_DEMO
                  ? "Create local preview link"
                  : "Generate secure link"}
            </button>

            {shareUrl && (
              <div className="flex items-center gap-2 rounded-lg bg-bg-tertiary p-2">
                <a
                  href={shareUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="min-w-0 flex-1 break-all text-xs text-teal underline"
                >
                  {shareUrl}
                </a>
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(shareUrl);
                      successToast("Copied to clipboard");
                    } catch {
                      errorToast(
                        "Clipboard unavailable. Copy the displayed link manually.",
                      );
                    }
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
