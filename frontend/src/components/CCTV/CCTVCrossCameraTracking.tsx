import { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Bookmark,
  Download,
  GitBranch,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import type {
  CCTVMomentDraft,
  CCTVMomentRequest,
  CCTVTrackingMoment,
  CCTVTrackingTrail,
} from "@/types/cctvTracking.types";
import {
  addCameraMoment,
  createCameraTrail,
  deleteCameraTrail,
  listCameraTrails,
  removeCameraMoment,
  reorderCameraMoments,
} from "@/services/cctvTrackingService";
import { apiErrorMessage } from "@/services/api";
import { WORKSPACE_CHANGED } from "@/demo/events";
import {
  exportTrackingTrail,
  MAX_CCTV_TRAILS,
  MAX_TRAIL_MOMENTS,
  moveMomentIds,
  SOURCE_LABELS,
  TRACKING_NOTICE,
  trackingRoute,
} from "@/utils/cctvTrackingUtils";
import { formatPlaybackTime } from "@/utils/cctvUtils";
import { downloadJSON } from "@/utils/exportUtils";
import { successToast } from "@/components/Common/ToastNotification";
import ConfirmModal from "@/components/Common/ConfirmModal";

interface Props {
  draft: CCTVMomentDraft | null;
  onCancelDraft: () => void;
  onClose: () => void;
  onChooseCamera: () => void;
  canJump: (moment: CCTVTrackingMoment) => boolean;
  onJump: (moment: CCTVTrackingMoment) => void;
}
export default function CCTVCrossCameraTracking({
  draft,
  onCancelDraft,
  onClose,
  onChooseCamera,
  canJump,
  onJump,
}: Props) {
  const [trails, setTrails] = useState<CCTVTrackingTrail[]>([]);
  const [selectedId, setSelectedId] = useState("new");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [remove, setRemove] = useState<{
    trailId: string;
    momentId?: string;
  } | null>(null);

  useEffect(() => {
    let active = true;
    const load = () =>
      listCameraTrails()
        .then((data) => {
          if (active) {
            setTrails(data);
            setLoading(false);
          }
        })
        .catch((error) => {
          if (active) {
            setError(apiErrorMessage(error));
            setLoading(false);
          }
        });
    load();
    window.addEventListener(WORKSPACE_CHANGED, load);
    return () => {
      active = false;
      window.removeEventListener(WORKSPACE_CHANGED, load);
    };
  }, [retry]);
  useEffect(() => {
    setNote("");
    setConfirmed(false);
    setError("");
  }, [draft?.draft_id]);

  const trail = trails.find((trail) => trail.id === selectedId);
  const route = trackingRoute(trail?.moments ?? []);
  const remember = (updated: CCTVTrackingTrail) => {
    setTrails((current) =>
      current.some((trail) => trail.id === updated.id)
        ? current.map((trail) => (trail.id === updated.id ? updated : trail))
        : [updated, ...current],
    );
    setSelectedId(updated.id);
  };
  const save = async () => {
    if (
      busy ||
      (selectedId === "new" && title.trim().length < 3) ||
      (draft && (!confirmed || note.trim().length < 3))
    )
      return;
    setBusy(true);
    setError("");
    try {
      const moment: CCTVMomentRequest | undefined = draft
        ? {
            camera_id: draft.camera_id,
            source_kind: draft.source_kind,
            source_instance: draft.source_instance,
            playback_seconds: draft.playback_seconds,
            note: note.trim(),
            manual_association: confirmed,
          }
        : undefined;
      const updated =
        selectedId === "new"
          ? await createCameraTrail(title.trim(), moment)
          : await addCameraMoment(selectedId, moment!);
      remember(updated);
      setTitle("");
      onCancelDraft();
      successToast(
        moment
          ? "Moment added to the manual camera trail"
          : "Manual tracking trail created",
      );
    } catch (error) {
      setError(apiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  const move = async (id: string, direction: -1 | 1) => {
    if (!trail || busy) return;
    setBusy(true);
    setError("");
    try {
      remember(
        await reorderCameraMoments(
          trail.id,
          moveMomentIds(trail.moments, id, direction),
        ),
      );
    } catch (error) {
      setError(apiErrorMessage(error));
      setRetry((value) => value + 1);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      id="cctv-tracking-panel"
      aria-labelledby="cctv-tracking-heading"
      className="scroll-mt-4 border-t-2 border-teal/30 bg-paper-sunk/30 p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3
            id="cctv-tracking-heading"
            className="dossier-title flex items-center gap-2 text-xl font-semibold"
          >
            <GitBranch className="h-5 w-5 text-teal" />
            Cross-camera tracking
          </h3>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-teal">
            Manual event trails · not identity tracking
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={onClose}
          aria-label="Close camera tracking"
          className="rounded-lg border border-paper-line p-2 text-ink-soft"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-3 rounded-lg border border-teal/20 bg-teal-soft/60 p-3 text-xs leading-relaxed text-teal">
        {TRACKING_NOTICE}
      </p>
      {loading && (
        <p className="mt-3 text-xs text-ink-soft" role="status">
          Loading saved camera trails…
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="mt-3 rounded-lg bg-risk-critical/10 p-3 text-sm text-risk-critical"
        >
          {error}
          <button
            type="button"
            onClick={() => {
              setError("");
              setRetry((value) => value + 1);
            }}
            className="ml-2 underline"
          >
            Refresh trails
          </button>
        </p>
      )}
      <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div className="min-w-0 space-y-4">
          <div>
            <label
              htmlFor="cctv-trail-selector"
              className="mb-1 block text-xs font-semibold"
            >
              Tracking trail
            </label>
            <select
              id="cctv-trail-selector"
              disabled={busy}
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full rounded-lg border border-paper-line bg-paper-raised px-3 py-2 text-sm"
            >
              <option value="new">Create a new event trail…</option>
              {trails.map((trail) => (
                <option key={trail.id} value={trail.id}>
                  {trail.title} ({trail.moments.length} moments)
                </option>
              ))}
            </select>
            <p className="mt-1 text-[10px] text-ink-soft">
              {trails.length}/{MAX_CCTV_TRAILS} trails saved in this browser.
            </p>
          </div>
          {selectedId === "new" && (
            <div>
              <label
                htmlFor="cctv-trail-title"
                className="mb-1 block text-xs font-semibold"
              >
                New trail title
              </label>
              <input
                id="cctv-trail-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={80}
                placeholder="Example: Loading-area event review"
                className="w-full rounded-lg border border-paper-line bg-paper-raised px-3 py-2 text-sm"
              />
            </div>
          )}
          {draft ? (
            <div className="rounded-xl border border-teal/25 bg-paper-raised p-4">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Bookmark className="h-4 w-4 text-teal" />
                Captured moment
              </p>
              <p className="mt-2 text-xs text-ink-soft">
                {draft.camera_id} · {draft.camera_name} ·{" "}
                {formatPlaybackTime(draft.playback_seconds)}
              </p>
              <p className="mt-1 text-[11px] text-ink-soft">
                {SOURCE_LABELS[draft.source_kind]} · relative playback time
              </p>
              <label
                htmlFor="cctv-tracking-note"
                className="mb-1 mt-4 block text-xs font-semibold"
              >
                Tracking moment note
              </label>
              <textarea
                id="cctv-tracking-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Describe this event and why you are linking it. Do not claim an automated identity match."
                className="w-full rounded-lg border border-paper-line bg-paper-sunk p-3 text-sm"
              />
              <label className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-ink-soft">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="mt-0.5 accent-teal"
                />
                I am linking these events manually. This does not verify that
                they show the same person or object.
              </label>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={save}
                  disabled={
                    busy ||
                    !confirmed ||
                    note.trim().length < 3 ||
                    (selectedId === "new" && title.trim().length < 3)
                  }
                  className="rounded-lg bg-teal px-4 py-2 text-xs font-semibold text-white hover:bg-teal-dark disabled:opacity-50"
                >
                  {busy ? "Saving…" : "Save tracking moment"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={onCancelDraft}
                  className="rounded-lg border border-paper-line px-3 py-2 text-xs text-ink-soft"
                >
                  Cancel moment
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-paper-line p-4 text-sm text-ink-soft">
              <p>
                Select a moment in one camera, then link another camera's moment
                into this trail. Use the bookmark button on a camera tile or{" "}
                <strong>Add moment to trail</strong> in a single view.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {selectedId === "new" && (
                  <button
                    type="button"
                    onClick={save}
                    disabled={busy || title.trim().length < 3}
                    className="rounded-lg bg-teal px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    Create trail
                  </button>
                )}
                <button
                  type="button"
                  onClick={onChooseCamera}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-paper-line bg-paper-raised px-3 py-2 text-xs font-semibold text-teal"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Choose camera moment
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="min-w-0">
          {trail ? (
            <div className="rounded-xl border border-paper-line bg-paper-raised p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h4 className="break-words text-base font-semibold">
                    {trail.title}
                  </h4>
                  <p className="mt-1 text-xs text-ink-soft">
                    {trail.moments.length}/{MAX_TRAIL_MOMENTS} linked moments ·{" "}
                    {
                      new Set(trail.moments.map((moment) => moment.camera_id))
                        .size
                    }{" "}
                    cameras · {Math.max(0, route.length - 1)} view{" "}
                    {route.length === 2 ? "change" : "changes"}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      downloadJSON(
                        `manual-camera-trail-${trail.id.slice(0, 8)}.json`,
                        exportTrackingTrail(trail),
                      )
                    }
                    className="rounded-lg border border-paper-line p-2 text-teal"
                    aria-label="Export camera trail"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setRemove({ trailId: trail.id })}
                    className="rounded-lg border border-paper-line p-2 text-risk-critical"
                    aria-label="Delete camera trail"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="mt-4">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
                  Manual camera sequence
                </p>
                <div
                  aria-label="Manual camera sequence"
                  className="flex items-center gap-2 overflow-x-auto rounded-lg bg-teal-soft/50 p-3"
                >
                  {route.length ? (
                    route.map((id, index) => (
                      <span
                        key={`${index}-${id}`}
                        className="flex shrink-0 items-center gap-2"
                      >
                        {index > 0 && (
                          <ArrowRight className="h-4 w-4 text-teal" />
                        )}
                        <span className="rounded border border-teal/20 bg-paper-raised px-2 py-1 font-mono text-xs font-semibold text-teal">
                          {id}
                        </span>
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-ink-soft">
                      Add a moment to start the trail.
                    </span>
                  )}
                </div>
              </div>
              <p className="mt-3 text-[10px] text-ink-soft">
                Order is operator-defined, not inferred travel or synchronised
                event time.
              </p>
              <ol
                aria-label="Tracked camera moments"
                className="mt-3 max-h-[420px] space-y-3 overflow-y-auto pr-1"
              >
                {trail.moments.map((moment, index) => (
                  <li
                    key={moment.id}
                    className="rounded-lg border border-paper-line p-3"
                  >
                    <div className="flex items-start gap-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-soft text-[11px] font-bold text-teal">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold">
                          {moment.camera_id} · {moment.camera_name}
                        </p>
                        <p className="mt-1 text-[11px] text-ink-soft">
                          {formatPlaybackTime(moment.playback_seconds)} ·{" "}
                          {SOURCE_LABELS[moment.source_kind]}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button
                          disabled={busy || index === 0}
                          onClick={() => move(moment.id, -1)}
                          aria-label={`Move moment ${index + 1} up`}
                          className="rounded p-1 text-ink-soft disabled:opacity-30"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          disabled={busy || index === trail.moments.length - 1}
                          onClick={() => move(moment.id, 1)}
                          aria-label={`Move moment ${index + 1} down`}
                          className="rounded p-1 text-ink-soft disabled:opacity-30"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          disabled={busy}
                          onClick={() =>
                            setRemove({
                              trailId: trail.id,
                              momentId: moment.id,
                            })
                          }
                          aria-label={`Remove moment ${index + 1}`}
                          className="rounded p-1 text-risk-critical"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap break-words text-xs text-ink-soft">
                      {moment.note}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[9px] font-semibold uppercase tracking-wide text-risk-medium">
                        Manual · unverified association
                      </span>
                      <button
                        type="button"
                        disabled={!canJump(moment)}
                        onClick={() => onJump(moment)}
                        className="text-xs font-semibold text-teal underline disabled:no-underline disabled:opacity-40"
                        aria-label={`Jump to moment ${index + 1}`}
                      >
                        Jump to moment
                      </button>
                    </div>
                    {!canJump(moment) && (
                      <p className="mt-2 text-[10px] text-ink-soft">
                        Source closed, replaced or unavailable. Only the saved
                        event metadata remains.
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-paper-line p-8 text-center text-sm text-ink-soft">
              <GitBranch className="mx-auto mb-3 h-7 w-7 text-teal" />
              <p>Create or select a trail to see linked camera moments here.</p>
              <p className="mt-2 text-xs">
                No event links are generated automatically.
              </p>
            </div>
          )}
        </div>
      </div>
      <ConfirmModal
        open={Boolean(remove)}
        title={
          remove?.momentId
            ? "Remove this tracked moment?"
            : "Delete this camera trail?"
        }
        message={
          remove?.momentId
            ? "The saved event note and its position in this manual trail will be removed. Your recording is not affected."
            : "All moments and notes in this trail will be removed from this browser. Download the JSON first if you want to keep it."
        }
        confirmLabel={remove?.momentId ? "Remove moment" : "Delete trail"}
        danger
        onCancel={() => setRemove(null)}
        onConfirm={async () => {
          if (!remove || busy) return;
          const request = remove;
          setRemove(null);
          setBusy(true);
          setError("");
          try {
            if (request.momentId)
              remember(
                await removeCameraMoment(request.trailId, request.momentId),
              );
            else {
              await deleteCameraTrail(request.trailId);
              setTrails((current) =>
                current.filter((trail) => trail.id !== request.trailId),
              );
              setSelectedId("new");
            }
          } catch (error) {
            setError(apiErrorMessage(error));
          } finally {
            setBusy(false);
          }
        }}
      />
    </section>
  );
}
