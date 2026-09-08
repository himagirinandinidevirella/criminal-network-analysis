import { useState } from "react";
import { Flag, Loader2, X } from "lucide-react";
import { flagCCTVForReview } from "@/services/cctvService";
import { apiErrorMessage } from "@/services/api";
import { successToast } from "@/components/Common/ToastNotification";
import { formatPlaybackTime } from "@/utils/cctvUtils";
import type { CCTVReviewTarget, CCTVReviewRequest } from "@/types/cctv.types";

export default function CCTVReviewForm({
  target,
  onClose,
}: {
  target: CCTVReviewTarget;
  onClose: () => void;
}) {
  const [note, setNote] = useState("");
  const [severity, setSeverity] =
    useState<CCTVReviewRequest["severity"]>("MEDIUM");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      aria-label="Flag CCTV moment for review"
      className="border-t border-paper-line bg-paper-sunk/50 p-4 sm:p-5"
      onSubmit={async (event) => {
        event.preventDefault();
        if (saving || note.trim().length < 3) return;
        setSaving(true);
        setError("");
        try {
          await flagCCTVForReview({
            camera_id: target.camera_id,
            view_id: target.view_id,
            playback_seconds: target.playback_seconds,
            note: note.trim(),
            severity,
          });
          successToast("CCTV review flag saved to Alerts");
          onClose();
        } catch (error) {
          setError(apiErrorMessage(error));
        } finally {
          setSaving(false);
        }
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Flag className="h-4 w-4 text-seal" />
            Flag this moment for review
          </h3>
          <p className="mt-1 break-words text-xs text-ink-soft">
            {target.label} · {formatPlaybackTime(target.playback_seconds)}
          </p>
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={onClose}
          aria-label="Close CCTV review form"
          className="rounded p-1.5 text-ink-soft"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-3 text-xs text-teal">
        This is a manual demo alert, not an automated detection or
        identification. Only the note, source and playback time are saved—no
        footage.
      </p>
      <label
        htmlFor="cctv-review-note"
        className="mb-1 mt-4 block text-xs font-semibold"
      >
        Review note
      </label>
      <textarea
        id="cctv-review-note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        required
        minLength={3}
        maxLength={500}
        rows={3}
        placeholder="Describe a fictional observation to review…"
        autoFocus
        className="w-full rounded-lg border border-paper-line bg-paper-raised p-3 text-sm"
      />
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <label
            htmlFor="cctv-review-priority"
            className="mb-1 block text-xs font-semibold"
          >
            Review priority
          </label>
          <select
            id="cctv-review-priority"
            value={severity}
            onChange={(e) =>
              setSeverity(e.target.value as CCTVReviewRequest["severity"])
            }
            className="rounded-lg border border-paper-line bg-paper-raised px-3 py-2 text-sm"
          >
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={saving || note.trim().length < 3}
          className="flex items-center gap-2 rounded-lg bg-seal px-4 py-2 text-sm font-semibold text-white hover:bg-seal-dark disabled:opacity-50"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}Save review
          flag
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-risk-critical">
          {error}
        </p>
      )}
    </form>
  );
}
