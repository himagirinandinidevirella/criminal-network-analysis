import CCTVCrossCameraTracking from "./CCTVCrossCameraTracking";
import { canReplayMoment, cctvMomentSource } from "@/utils/cctvTrackingUtils";
import type {
  CCTVMomentDraft,
  CCTVTrackingMoment,
} from "@/types/cctvTracking.types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Camera,
  Video,
  Upload,
  Play,
  Pause,
  Download,
  Flag,
  Search,
  X,
  ArrowRight,
  LayoutGrid,
  Monitor,
  GitBranch,
  Bookmark,
} from "lucide-react";
const IS_DEMO = true;
import { getCCTVCameras } from "@/services/cctvService";
import { apiErrorMessage } from "@/services/api";
import {
  errorToast,
  successToast,
} from "@/components/Common/ToastNotification";
import { triggerDownload } from "@/utils/exportUtils";
import { captureCCTVFrame } from "@/utils/cctvRenderer";
import { captureCCTVWall } from "@/utils/cctvWallSnapshot";
import {
  filterCCTVCameras,
  formatPlaybackTime,
  LOCAL_CCTV_SOURCE,
} from "@/utils/cctvUtils";
import {
  CCTVRecordingRegistry,
  planCCTVRecordings,
  type CCTVRecording,
} from "@/utils/cctvRecordings";
import { useFaceDetectionModel } from "@/hooks/useFaceDetection";
import type { CameraDetectionState } from "@/types/faceDetection.types";
import type {
  CCTVCamera,
  CCTVCameraStatus,
  CCTVReviewTarget,
} from "@/types/cctv.types";
import CCTVCameraFeed, { type CCTVFeedHandle } from "./CCTVCameraFeed";
import FaceDetectionControls from "./FaceDetectionControls";
import PersonDetectionControls from "./PersonDetectionControls";
import { usePersonDetectionModel } from "@/hooks/usePersonDetection";
import CCTVReviewForm from "./CCTVReviewForm";

const STATUS = {
  AVAILABLE: { label: "Available", color: "text-teal bg-teal-soft" },
  OFFLINE: {
    label: "Offline",
    color: "text-risk-critical bg-risk-critical/10",
  },
  MAINTENANCE: {
    label: "Maintenance",
    color: "text-risk-medium bg-risk-medium/10",
  },
};
const LOCAL_VIEWS: CCTVCamera[] = Array.from({ length: 4 }, (_, i) => ({
  id: `LOCAL-0${i + 1}`,
  name: `Recording view ${i + 1}`,
  location: "Local review slot · no camera connected",
  status: "OFFLINE",
  scene: "junction",
  notice:
    "No live camera gateway is configured. Open an authorised recording for this view.",
}));
function revealFeed(id: string) {
  requestAnimationFrame(() =>
    document.getElementById(`cctv-view-${id}`)?.scrollIntoView({
      block: "nearest",
      behavior: reducedMotion() ? "auto" : "smooth",
    }),
  );
}
const reducedMotion = () =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

export default function CCTVMonitor() {
  const [cameras, setCameras] = useState<CCTVCamera[]>([]);
  const [cameraId, setCameraId] = useState("");
  const [view, setView] = useState<"all" | "single">("all");
  const [loading, setLoading] = useState(true);
  const [cameraError, setCameraError] = useState("");
  const [reload, setReload] = useState(0);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<CCTVCameraStatus | "ALL">("ALL");
  const [paused, setPaused] = useState(reducedMotion);
  const [fileError, setFileError] = useState("");
  const [recordings, setRecordings] = useState<Record<string, CCTVRecording>>(
    {},
  );
  const [ready, setReady] = useState<Record<string, boolean>>({});
  const [snapshotting, setSnapshotting] = useState(false);
  const [showTracking, setShowTracking] = useState(false);
  const [trackingDraft, setTrackingDraft] = useState<CCTVMomentDraft | null>(
    null,
  );
  const [reviewTarget, setReviewTarget] = useState<CCTVReviewTarget | null>(
    null,
  );
  const [detectionEnabled, setDetectionEnabled] = useState(false);
  const [threshold, setThreshold] = useState(0.6);
  const [modelRetry, setModelRetry] = useState(0);
  const [detections, setDetections] = useState<
    Record<string, CameraDetectionState>
  >({});
  
  const [personDetectionEnabled, setPersonDetectionEnabled] = useState(false);
  const [personThreshold, setPersonThreshold] = useState(0.5);
  const [personModelRetry, setPersonModelRetry] = useState(0);
  const [personDetections, setPersonDetections] = useState<
    Record<string, any>
  >({});

  const registry = useMemo(() => new CCTVRecordingRegistry(), []);
  const feeds = useRef(new Map<string, CCTVFeedHandle>());
  const fileRef = useRef<HTMLInputElement>(null);
  const model = useFaceDetectionModel(detectionEnabled, modelRetry);
  const personModel = usePersonDetectionModel(personDetectionEnabled, personModelRetry);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setCameraError("");
    getCCTVCameras()
      .then((data) => {
        if (cancelled) return;
        const list = data.length ? data : LOCAL_VIEWS;
        setCameras(list);
        setCameraId((current) =>
          list.some((camera) => camera.id === current) ? current : list[0].id,
        );
      })
      .catch((error) => {
        if (!cancelled) setCameraError(apiErrorMessage(error));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reload]);
  useEffect(() => () => registry.dispose(), [registry]);

  const onReadyChange = useCallback(
    (id: string, value: boolean) =>
      setReady((current) =>
        current[id] === value ? current : { ...current, [id]: value },
      ),
    [],
  );
  const onDetection = useCallback(
    (id: string, value: CameraDetectionState) =>
      setDetections((current) => {
        const previous = current[id];
        return previous?.sourceKey === value.sourceKey &&
          previous?.status === value.status &&
          previous?.frame === value.frame &&
          previous?.error === value.error
          ? current
          : { ...current, [id]: value };
      }),
    [],
  );

  const onPersonDetection = useCallback(
    (id: string, value: any) =>
      setPersonDetections((current) => {
        const previous = current[id];
        return previous?.sourceKey === value.sourceKey &&
          previous?.status === value.status &&
          previous?.frame === value.frame &&
          previous?.error === value.error
          ? current
          : { ...current, [id]: value };
      }),
    [],
  );

  const focus = useCallback((id: string) => {
    setCameraId(id);
    setView("single");
    setReviewTarget(null);
  }, []);
  const camera = cameras.find((item) => item.id === cameraId);
  const recording = recordings[cameraId];
  const filtered = useMemo(
    () => filterCCTVCameras(cameras, query, status),
    [cameras, query, status],
  );
  const visibleCameras =
    view === "all"
      ? cameras
      : cameras.filter((camera) => camera.id === cameraId);
  const anyFrame = visibleCameras.some((camera) => ready[camera.id]);
  const hasFrame = Boolean(ready[cameraId]);
  const available = cameras.filter(
    (camera) => camera.status === "AVAILABLE",
  ).length;
  const videoCount = visibleCameras.filter((camera) =>
    Boolean(recordings[camera.id]),
  ).length;
  const frames =
    detectionEnabled && model.status === "ready"
      ? visibleCameras.flatMap((camera) => {
          const result = detections[camera.id],
            source = recordings[camera.id];
          return source &&
            result?.sourceKey === source.url &&
            result.status === "ready" &&
            result.frame &&
            Math.abs(
              (feeds.current.get(camera.id)?.time() ?? 0) -
                result.frame.sourceTime,
            ) <= 1.2
            ? [result.frame]
            : [];
        })
      : [];
      
  const personFrames =
    personDetectionEnabled && personModel.status === "ready"
      ? visibleCameras.flatMap((camera) => {
          const result = personDetections[camera.id],
            source = recordings[camera.id];
          return source &&
            result?.sourceKey === source.url &&
            result.status === "ready" &&
            result.frame &&
            Math.abs(
              (feeds.current.get(camera.id)?.time() ?? 0) -
                result.frame.sourceTime,
            ) <= 1.2
            ? [result.frame]
            : [];
        })
      : [];

  const openRecordings = (files: File[]) => {
    if (!files.length) return;
    try {
      const plan = planCCTVRecordings(
        files,
        cameras.map((camera) => camera.id),
        cameraId,
      );
      setRecordings(registry.install(plan));
      setFileError("");
      setReviewTarget(null);
      if (files.length > 1) setView("all");
    } catch (error) {
      setFileError(apiErrorMessage(error));
    }
  };
  const sample = () => {
    const id = cameraId || cameras[0]?.id;
    if (!id) return;
    setRecordings(registry.sample(id));
    setCameraId(id);
    setDetectionEnabled(true);
    setPaused(true);
    setView("all");
    setReviewTarget(null);
    setFileError("");
    revealFeed(id);
  };
  const revealTracking = () =>
    requestAnimationFrame(() =>
      document
        .getElementById("cctv-tracking-panel")
        ?.scrollIntoView({
          block: "start",
          behavior: reducedMotion() ? "auto" : "smooth",
        }),
    );
  const captureTrackingMoment = (id: string) => {
    const camera = cameras.find((camera) => camera.id === id);
    const feed = feeds.current.get(id);
    const source = camera ? cctvMomentSource(camera, recordings[id]) : null;
    if (!camera || !source || !feed?.ready() || !source.source_instance) {
      errorToast("Wait for an available frame before tracking a moment.");
      return;
    }
    feed.pause();
    setPaused(true);
    setTrackingDraft({
      draft_id: crypto.randomUUID(),
      camera_id: id,
      camera_name: camera.name,
      playback_seconds: feed.time(),
      ...source,
    });
    setShowTracking(true);
    revealTracking();
  };
  const canJumpToMoment = (moment: CCTVTrackingMoment) =>
    canReplayMoment(
      moment,
      cameras.find((camera) => camera.id === moment.camera_id),
      recordings[moment.camera_id],
    ) && Boolean(ready[moment.camera_id]);
  const jumpToMoment = (moment: CCTVTrackingMoment) => {
    if (!canJumpToMoment(moment)) {
      errorToast(
        "The original media instance is not available. This trail retains metadata only.",
      );
      return;
    }
    try {
      setPaused(true);
      focus(moment.camera_id);
      feeds.current.get(moment.camera_id)?.seek(moment.playback_seconds);
      revealFeed(moment.camera_id);
    } catch (error) {
      errorToast(apiErrorMessage(error));
    }
  };
  const snapshot = async () => {
    if (snapshotting) return;
    setSnapshotting(true);
    try {
      if (view === "all") {
        const blob = await captureCCTVWall(
          cameras.map((camera) => {
            const feed = feeds.current.get(camera.id),
              source = recordings[camera.id],
              detection = detections[camera.id];
            return {
              label: `${camera.id} · ${camera.name}`,
              sourceLabel: source
                ? source.kind === "sample"
                  ? "AI-GENERATED TEST CLIP"
                  : "LOCAL RECORDING"
                : camera.status === "AVAILABLE"
                  ? "SIMULATED · NOT LIVE"
                  : "NO FEED",
              source: feed?.ready() ? feed.frame() : null,
              seconds: feed?.time() ?? 0,
              boxes:
                detectionEnabled &&
                source &&
                detection?.sourceKey === source.url &&
                detection.frame &&
                Math.abs((feed?.time() ?? 0) - detection.frame.sourceTime) <=
                  1.2
                  ? detection.frame.boxes
                  : [],
            };
          }),
        );
        triggerDownload(blob, "cctv-all-cameras.png");
      } else {
        const feed = feeds.current.get(cameraId),
          source = feed?.frame();
        if (!feed?.ready() || !source)
          throw new Error("Wait for a frame before taking a snapshot.");
        const time = feed.time();
        const blob = await captureCCTVFrame(
          source,
          recording?.name ?? `${cameraId} · ${camera?.name}`,
          time,
          !recording || recording.kind === "sample",
        );
        triggerDownload(
          blob,
          `cctv-${recording ? "local-recording" : cameraId}-${formatPlaybackTime(time).replace(/:/g, "-")}.png`,
        );
      }
      successToast(
        "CCTV snapshot downloaded. No image was stored or uploaded.",
      );
    } catch (error) {
      errorToast(apiErrorMessage(error));
    } finally {
      setSnapshotting(false);
    }
  };

  return (
    <section
      id="cctv-monitor"
      aria-labelledby="cctv-heading"
      className="scroll-mt-4 overflow-hidden rounded-xl border border-paper-line bg-paper-raised shadow-card"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-paper-line p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-lg border border-teal/20 bg-teal-soft p-2.5 text-teal">
            <Video className="h-5 w-5" />
          </div>
          <div>
            <h2
              id="cctv-heading"
              className="dossier-title text-xl font-semibold"
            >
              CCTV Monitor
            </h2>
            <p className="mt-1 text-xs text-ink-soft">
              {IS_DEMO
                ? `${available} simulated feeds available · ${cameras.length} demo cameras`
                : "Local footage review · no live camera gateway configured"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="flex rounded-lg border border-paper-line p-0.5"
            role="group"
            aria-label="CCTV view mode"
          >
            <button
              type="button"
              aria-pressed={view === "all"}
              onClick={() => {
                setView("all");
                setReviewTarget(null);
              }}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold ${view === "all" ? "bg-teal text-white" : "text-ink-soft"}`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              All cameras
            </button>
            <button
              type="button"
              aria-pressed={view === "single"}
              onClick={() => setView("single")}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold ${view === "single" ? "bg-teal text-white" : "text-ink-soft"}`}
            >
              <Monitor className="h-3.5 w-3.5" />
              Single camera
            </button>
          </div>
          <button
            type="button"
            disabled={!cameras.length}
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-paper-line px-3 py-2 text-xs font-semibold text-ink-soft hover:bg-paper-sunk disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            {view === "all" ? "Open recordings" : "Open recording"}
          </button>
          {IS_DEMO && (
            <button
              type="button"
              onClick={() => {
                setShowTracking(true);
                revealTracking();
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-teal/30 bg-teal-soft px-3 py-2 text-xs font-semibold text-teal"
            >
              <GitBranch className="h-4 w-4" />
              Cross-camera tracking
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="video/mp4,video/webm,.mp4,.webm"
            aria-label="CCTV recording file"
            className="hidden"
            onChange={(event) => {
              openRecordings(Array.from(event.target.files ?? []));
              event.target.value = "";
            }}
          />
        </div>
      </header>
      <FaceDetectionControls
        enabled={detectionEnabled}
        model={model}
        threshold={threshold}
        count={frames.reduce((sum, frame) => sum + frame.boxes.length, 0)}
        analysedViews={frames.length}
        onEnabled={setDetectionEnabled}
        onThreshold={setThreshold}
        canLoadSample={cameras.length > 0}
        onRetry={() => {
          setModelRetry((value) => value + 1);
          const id = Object.keys(recordings)[0];
          if (id) revealFeed(id);
        }}
        onSample={sample}
      />
      <PersonDetectionControls
        enabled={personDetectionEnabled}
        model={personModel}
        threshold={personThreshold}
        count={personFrames.reduce((sum, frame) => sum + frame.boxes.length, 0)}
        analysedViews={personFrames.length}
        onEnabled={setPersonDetectionEnabled}
        onThreshold={setPersonThreshold}
        canLoadSample={cameras.length > 0}
        onRetry={() => {
          setPersonModelRetry((value) => value + 1);
          const id = Object.keys(recordings)[0];
          if (id) revealFeed(id);
        }}
        onSample={sample}
      />
      <p className="border-b border-paper-line px-4 py-2 text-[11px] leading-relaxed text-ink-soft sm:px-5">
        Four views, one screen. Open up to four MP4 / WebM recordings (100 MB
        each), assigned starting with {cameraId || "the first view"}. Real
        all-sides coverage requires separate camera angles; this is a tiled
        view, not 360° reconstruction. No live CCTV feeds are connected.
      </p>
      {fileError && (
        <p
          role="alert"
          className="mx-4 mt-4 rounded-lg border border-risk-critical/20 bg-risk-critical/5 p-3 text-sm text-risk-critical"
        >
          {fileError}
        </p>
      )}
      <div className="grid gap-4 p-4 sm:p-5 xl:grid-cols-[220px_minmax(0,1fr)]">
        <aside aria-label="CCTV camera list" className="min-w-0">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-ink-faint" />
            <input
              aria-label="Find CCTV camera"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a camera…"
              className="w-full rounded-lg border border-paper-line bg-paper-sunk py-2 pl-8 pr-2 text-xs"
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
            aria-label="CCTV camera status"
            className="mt-2 w-full rounded-lg border border-paper-line bg-paper-raised px-2 py-2 text-xs text-ink-soft"
          >
            <option value="ALL">All cameras</option>
            <option value="AVAILABLE">Available</option>
            <option value="OFFLINE">Offline</option>
            <option value="MAINTENANCE">Maintenance</option>
          </select>
          <p className="mt-2 text-[10px] text-ink-soft">
            Filter the list; select a camera to focus its view.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 xl:grid-cols-1">
            {loading && (
              <p
                className="col-span-full py-4 text-xs text-ink-soft"
                role="status"
              >
                Loading demo cameras…
              </p>
            )}
            {cameraError && (
              <div
                className="col-span-full rounded-lg border border-risk-critical/20 p-3 text-xs text-risk-critical"
                role="alert"
              >
                <p>{cameraError}</p>
                <button
                  onClick={() => setReload((value) => value + 1)}
                  className="mt-2 underline"
                >
                  Retry cameras
                </button>
              </div>
            )}
            {!loading &&
              !cameraError &&
              filtered.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={cameraId === item.id && view === "single"}
                  onClick={() => focus(item.id)}
                  className={`min-w-0 rounded-lg border p-3 text-left transition ${cameraId === item.id ? "border-teal/50 bg-teal-soft/50" : "border-paper-line hover:bg-paper-sunk"}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <span className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold text-ink-soft">
                      <Camera className="h-3.5 w-3.5" />
                      {item.id}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${recordings[item.id] ? "bg-teal-soft text-teal" : STATUS[item.status].color}`}
                    >
                      {recordings[item.id]
                        ? "Recording"
                        : STATUS[item.status].label}
                    </span>
                  </div>
                  <p className="mt-2 text-xs font-semibold">{item.name}</p>
                  <p className="mt-1 break-words text-[10px] text-ink-soft">
                    {recordings[item.id]?.name ?? item.location}
                  </p>
                </button>
              ))}
            {!loading && !cameraError && !filtered.length && (
              <div className="col-span-full rounded-lg border border-dashed border-paper-line p-3 text-xs text-ink-soft">
                <p>No cameras match these filters.</p>
                <button
                  onClick={() => {
                    setQuery("");
                    setStatus("ALL");
                  }}
                  className="mt-2 font-semibold text-teal underline"
                >
                  Reset camera filters
                </button>
              </div>
            )}
          </div>
        </aside>
        <div className="min-w-0">
          <div
            className={
              view === "all"
                ? "grid grid-cols-2 items-start gap-2 sm:gap-3"
                : "grid grid-cols-1"
            }
            aria-label={
              view === "all"
                ? "Combined CCTV camera wall"
                : "Focused CCTV camera"
            }
          >
            {cameras.map((item) => (
              <CCTVCameraFeed
                key={`${item.id}:${recordings[item.id]?.url ?? "simulation"}`}
                ref={(handle) => {
                  if (handle) feeds.current.set(item.id, handle);
                  else feeds.current.delete(item.id);
                }}
                camera={item}
                recording={recordings[item.id]}
                visible={view === "all" || item.id === cameraId}
                focused={view === "single" && item.id === cameraId}
                paused={paused}
                model={model}
                threshold={threshold}
                personModel={personModel}
                personThreshold={personThreshold}
                onFocus={focus}
                onTrack={IS_DEMO ? captureTrackingMoment : undefined}
                onReadyChange={onReadyChange}
                onDetection={onDetection}
                onPersonDetection={onPersonDetection}
              />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {(view === "all" || !recording) && (
              <button
                type="button"
                disabled={!anyFrame}
                onClick={() => setPaused((value) => !value)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-paper-line px-3 py-2 text-xs font-semibold text-ink-soft hover:bg-paper-sunk disabled:opacity-40"
              >
                {paused ? (
                  <Play className="h-3.5 w-3.5" />
                ) : (
                  <Pause className="h-3.5 w-3.5" />
                )}
                {paused
                  ? view === "all"
                    ? "Resume simulations"
                    : "Resume simulation"
                  : view === "all"
                    ? "Pause simulations"
                    : "Pause simulation"}
              </button>
            )}
            {view === "all" && videoCount > 0 && (
              <>
                <button
                  onClick={async () => {
                    const results = await Promise.allSettled(
                      visibleCameras.map((camera) =>
                        feeds.current.get(camera.id)?.play(),
                      ),
                    );
                    if (results.some((result) => result.status === "rejected"))
                      errorToast(
                        "Some recordings could not start. Open a single view to use its playback controls.",
                      );
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-paper-line px-3 py-2 text-xs font-semibold text-ink-soft"
                >
                  <Play className="h-3.5 w-3.5" />
                  Play all recordings
                </button>
                <button
                  onClick={() => feeds.current.forEach((feed) => feed.pause())}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-paper-line px-3 py-2 text-xs font-semibold text-ink-soft"
                >
                  <Pause className="h-3.5 w-3.5" />
                  Pause all recordings
                </button>
              </>
            )}
            <button
              type="button"
              onClick={snapshot}
              disabled={!anyFrame || snapshotting}
              className="inline-flex items-center gap-1.5 rounded-lg border border-paper-line px-3 py-2 text-xs font-semibold text-ink-soft hover:bg-paper-sunk disabled:opacity-40"
            >
              <Download className="h-3.5 w-3.5" />
              {view === "all"
                ? "Download combined snapshot"
                : "Download snapshot"}
            </button>
            {IS_DEMO && view === "single" && (
              <button
                type="button"
                disabled={!hasFrame}
                onClick={() => captureTrackingMoment(cameraId)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-teal/30 bg-teal-soft px-3 py-2 text-xs font-semibold text-teal disabled:opacity-40"
              >
                <Bookmark className="h-3.5 w-3.5" />
                Add moment to trail
              </button>
            )}
            {IS_DEMO && view === "single" && (
              <button
                type="button"
                disabled={!hasFrame || Boolean(reviewTarget)}
                onClick={() => {
                  const feed = feeds.current.get(cameraId);
                  if (!feed?.ready()) return;
                  feed.pause();
                  setPaused(true);
                  setReviewTarget({
                    camera_id: recording ? LOCAL_CCTV_SOURCE : cameraId,
                    view_id: cameraId,
                    label: `${cameraId} · ${recording ? "Local demo recording" : camera?.name}`,
                    playback_seconds: feed.time(),
                  });
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-teal px-3 py-2 text-xs font-semibold text-white hover:bg-teal-dark disabled:opacity-40"
              >
                <Flag className="h-3.5 w-3.5" />
                Flag for review
              </button>
            )}
            {view === "single" && recording && (
              <button
                type="button"
                onClick={() => {
                  setRecordings(registry.remove(cameraId));
                  setReviewTarget(null);
                  setFileError("");
                }}
                className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-paper-line px-3 py-2 text-xs text-ink-soft"
              >
                <X className="h-3.5 w-3.5" />
                Close recording
              </button>
            )}
            {view === "all" && Object.keys(recordings).length > 0 && (
              <button
                type="button"
                onClick={() => {
                  registry.dispose();
                  setRecordings({});
                  setReviewTarget(null);
                  setFileError("");
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-paper-line px-3 py-2 text-xs text-ink-soft"
              >
                <X className="h-3.5 w-3.5" />
                Close all recordings
              </button>
            )}
          </div>
          <div className="mt-3 flex flex-wrap justify-between gap-2 text-[11px] text-ink-soft">
            <p>
              Choose a camera for native playback controls and manual review.
              Recordings and face boxes are not uploaded or persisted.
            </p>
            {IS_DEMO && (
              <Link
                to="/alerts"
                className="inline-flex items-center gap-1 font-semibold text-teal"
              >
                Review flagged moments
                <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        </div>
      </div>
      {IS_DEMO && showTracking && (
        <CCTVCrossCameraTracking
          draft={trackingDraft}
          onCancelDraft={() => setTrackingDraft(null)}
          onClose={() => {
            setShowTracking(false);
            setTrackingDraft(null);
          }}
          onChooseCamera={() => {
            setView("all");
            revealFeed(cameraId || cameras[0]?.id || "CAM-01");
          }}
          canJump={canJumpToMoment}
          onJump={jumpToMoment}
        />
      )}
      {reviewTarget && (
        <CCTVReviewForm
          target={reviewTarget}
          onClose={() => setReviewTarget(null)}
        />
      )}
    </section>
  );
}
