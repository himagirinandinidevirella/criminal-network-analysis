import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Camera, WifiOff, Wrench, Maximize2, Bookmark } from "lucide-react";
import type { CCTVCamera } from "@/types/cctv.types";
import type {
  CameraDetectionState,
  FaceModelState,
} from "@/types/faceDetection.types";
import type { CCTVRecording } from "@/utils/cctvRecordings";
import { formatPlaybackTime } from "@/utils/cctvUtils";
import { useFaceDetection } from "@/hooks/useFaceDetection";
import { usePersonDetection } from "@/hooks/usePersonDetection";
import SimulatedCCTVFeed from "./SimulatedCCTVFeed";

export interface CCTVFeedHandle {
  frame(): HTMLVideoElement | HTMLCanvasElement | null;
  time(): number;
  ready(): boolean;
  pause(): void;
  play(): Promise<void>;
  seek(seconds: number): void;
}
interface Props {
  camera: CCTVCamera;
  recording?: CCTVRecording;
  visible: boolean;
  focused: boolean;
  paused: boolean;
  model: FaceModelState;
  threshold: number;
  onFocus: (id: string) => void;
  onTrack?: (id: string) => void;
  onReadyChange: (id: string, ready: boolean) => void;
  onDetection: (id: string, state: CameraDetectionState) => void;
  personModel: any;
  personThreshold: number;
  onPersonDetection: (id: string, state: any) => void;
}

/** A stable, keyed media element per camera, preserved when switching between wall and focus. */
const CCTVCameraFeed = forwardRef<CCTVFeedHandle, Props>(
  function CCTVCameraFeed(
    {
      camera,
      recording,
      visible,
      focused,
      paused,
      model,
      threshold,
      onFocus,
      onTrack,
      onReadyChange,
      onDetection,
      personModel,
      personThreshold,
      onPersonDetection,
    },
    ref,
  ) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const simulationSeek = useRef<((seconds: number) => void) | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [ready, setReady] = useState(false);
    const [error, setError] = useState("");
    const [seconds, setSeconds] = useState(0);
    const [inView, setInView] = useState(true);
    const simulation = !recording && camera.status === "AVAILABLE";
    const sourceKey = recording?.url ?? camera.id;
    const detection = useFaceDetection(
      videoRef,
      sourceKey,
      model.status === "ready" && Boolean(recording) && ready && !error,
      threshold,
      visible && inView,
    );
    const personDetection = usePersonDetection(
      videoRef as any,
      sourceKey,
      personModel.status === "ready" && Boolean(recording) && ready && !error,
      personThreshold,
      visible && inView
    );
    const onReady = useCallback(() => {
      setReady(true);
      setError("");
    }, []);
    const onError = useCallback((message: string) => {
      setReady(false);
      setError(message);
    }, []);

    useEffect(() => {
      const element = containerRef.current;
      if (!element || typeof IntersectionObserver === "undefined") return;
      const observer = new IntersectionObserver(([entry]) =>
        setInView(entry.isIntersecting),
      );
      observer.observe(element);
      return () => observer.disconnect();
    }, []);
    useEffect(() => {
      if (!visible) videoRef.current?.pause();
    }, [visible]);
    useEffect(() => {
      onReadyChange(camera.id, ready && !error);
    }, [camera.id, ready, error, onReadyChange]);
    useEffect(
      () => () => onReadyChange(camera.id, false),
      [camera.id, onReadyChange],
    );
    useEffect(() => {
      onDetection(camera.id, detection);
    }, [
      camera.id,
      detection.sourceKey,
      detection.status,
      detection.frame,
      detection.error,
      onDetection,
    ]);
    useEffect(() => {
      onPersonDetection(camera.id, personDetection);
    }, [
      camera.id,
      personDetection.sourceKey,
      personDetection.status,
      personDetection.frame,
      personDetection.error,
      onPersonDetection,
    ]);

    useImperativeHandle(
      ref,
      () => ({
        frame: () =>
          recording ? videoRef.current : simulation ? canvasRef.current : null,
        time: () =>
          recording
            ? (videoRef.current?.currentTime ?? 0)
            : Number(canvasRef.current?.dataset.elapsed ?? 0),
        ready: () =>
          ready &&
          !error &&
          (recording
            ? (videoRef.current?.readyState ?? 0) >= 2 &&
              !videoRef.current?.seeking
            : simulation),
        pause: () => videoRef.current?.pause(),
        seek: (value: number) => {
          if (!Number.isFinite(value) || value < 0 || value > 604800)
            throw new Error("Invalid playback time");
          if (
            recording &&
            videoRef.current &&
            videoRef.current.readyState >= 1
          ) {
            const video = videoRef.current;
            video.pause();
            const end = Number.isFinite(video.duration)
              ? video.duration
              : value;
            video.currentTime = Math.min(value, end);
            setSeconds(video.currentTime);
          } else if (simulation && simulationSeek.current)
            simulationSeek.current(value);
          else throw new Error("The source is not available for this moment");
        },
        play: async () => {
          if (recording && videoRef.current && ready && !error)
            await videoRef.current.play();
        },
      }),
      [recording, simulation, ready, error],
    );

    const frame =
      detection.frame && Math.abs(seconds - detection.frame.sourceTime) <= 1.2
        ? detection.frame
        : null;
    const personFrame =
      personDetection.frame && Math.abs(seconds - personDetection.frame.sourceTime) <= 1.2
        ? personDetection.frame
        : null;
    const aiLabel = !recording
      ? simulation
        ? "Illustration · not analysed"
        : "No footage"
      : model.status === "off"
        ? "Face detection off"
        : model.status === "loading"
          ? "Loading detector…"
          : model.status === "error"
            ? "Detector unavailable"
            : error
              ? "Video unavailable"
              : detection.status === "error"
                ? "Frame analysis unavailable"
                : frame
                  ? `${frame.boxes.length} ${frame.boxes.length === 1 ? "face" : "faces"} detected`
                  : "Waiting for analysis…";
    return (
      <div
        ref={containerRef}
        id={`cctv-view-${camera.id}`}
        hidden={!visible}
        style={!visible ? { display: "none" } : undefined}
        role="group"
        aria-label={`CCTV view ${camera.id}`}
        data-camera-id={camera.id}
        className="min-w-0 overflow-hidden rounded-lg border border-[#33434c] bg-[#17252e]"
      >
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2 text-paper">
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold">
              {camera.id} · {camera.name}
            </p>
            <p className="mt-0.5 truncate font-mono text-[9px] uppercase tracking-wide text-[#c7dace]">
              {recording
                ? recording.kind === "sample"
                  ? "AI-generated test clip · not live"
                  : "Local file · not uploaded"
                : simulation
                  ? "Simulated · not live"
                  : "No feed"}
            </p>
          </div>
          {onTrack && (
            <button
              type="button"
              disabled={!ready || Boolean(error) || (!recording && !simulation)}
              onClick={() => onTrack(camera.id)}
              aria-label={`Track moment from ${camera.id}`}
              className="shrink-0 rounded p-1.5 text-paper/80 hover:bg-white/10 disabled:opacity-30"
            >
              <Bookmark className="h-3.5 w-3.5" />
            </button>
          )}
          {!focused && (
            <button
              type="button"
              onClick={() => onFocus(camera.id)}
              aria-label={`Focus ${camera.id}`}
              className="shrink-0 rounded p-1.5 text-paper/80 hover:bg-white/10"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="relative aspect-video w-full overflow-hidden bg-[#101d26]">
          {recording ? (
            <video
              ref={videoRef}
              src={recording.url}
              controls={focused}
              loop={recording.kind === "sample"}
              muted
              playsInline
              preload="auto"
              aria-label={
                focused ? "Local CCTV recording" : `${camera.id} CCTV recording`
              }
              className="h-full w-full object-contain"
              onLoadedData={onReady}
              onTimeUpdate={(e) => setSeconds(e.currentTarget.currentTime)}
              onSeeking={() => setReady(false)}
              onSeeked={(e) => {
                if (e.currentTarget.readyState >= 2) {
                  setSeconds(e.currentTarget.currentTime);
                  onReady();
                }
              }}
              onError={() =>
                onError(
                  "This recording could not be played. Try an H.264 MP4 or a VP8/VP9 WebM file.",
                )
              }
            />
          ) : simulation ? (
            <SimulatedCCTVFeed
              camera={camera}
              paused={paused || !visible}
              canvasRef={canvasRef}
              onReady={onReady}
              onError={onError}
              onTime={setSeconds}
              seekRef={simulationSeek}
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center text-paper/70">
              {camera.status === "MAINTENANCE" ? (
                <Wrench className="h-6 w-6" />
              ) : (
                <WifiOff className="h-6 w-6" />
              )}
              <p className="text-xs font-semibold text-paper">
                {camera.status === "MAINTENANCE"
                  ? "Camera under maintenance"
                  : "Camera offline"}
              </p>
              {focused && (
                <p className="max-w-sm text-xs leading-relaxed">
                  {camera.notice}
                </p>
              )}
            </div>
          )}
          {recording && ((frame && frame.boxes.length > 0) || (personFrame && personFrame.boxes.length > 0)) && (
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full"
              viewBox={`0 0 ${frame?.width || personFrame?.width || 0} ${frame?.height || personFrame?.height || 0}`}
              preserveAspectRatio="xMidYMid meet"
              aria-label={`Detection overlay for ${camera.id}`}
            >
              {frame && frame.boxes.map((box, index) => (
                <g key={`face-${index}`}>
                  <title>{`Face detected, ${Math.round(box.confidence * 100)} percent confidence. No identity assigned.`}</title>
                  <rect
                    data-face-box="true"
                    x={box.x * frame.width}
                    y={box.y * frame.height}
                    width={box.width * frame.width}
                    height={box.height * frame.height}
                    fill="none"
                    stroke="#71edb3"
                    strokeWidth="2"
                    vectorEffect="non-scaling-stroke"
                  />
                  <text
                    x={box.x * frame.width + 3}
                    y={Math.max(18, box.y * frame.height - 7)}
                    fill="#90ffd0"
                    stroke="#10251d"
                    strokeWidth="2"
                    paintOrder="stroke"
                    fontFamily="monospace"
                    fontSize={Math.max(14, frame.width / 40)}
                  >{`Face ${Math.round(box.confidence * 100)}%`}</text>
                </g>
              ))}
              
              {personFrame && personFrame.boxes.map((box, index) => (
                <g key={`person-${index}`}>
                  <title>{`Person detected, ${Math.round(box.score * 100)} percent confidence.`}</title>
                  <rect
                    data-person-box="true"
                    x={box.x}
                    y={box.y}
                    width={box.width}
                    height={box.height}
                    fill="none"
                    stroke="#ed718d"
                    strokeWidth="2"
                    vectorEffect="non-scaling-stroke"
                  />
                  <text
                    x={box.x + 3}
                    y={Math.max(18, box.y - 7)}
                    fill="#ff90ab"
                    stroke="#251015"
                    strokeWidth="2"
                    paintOrder="stroke"
                    fontFamily="monospace"
                    fontSize={Math.max(14, personFrame.width / 40)}
                  >{`Person ${Math.round(box.score * 100)}%`}</text>
                </g>
              ))}
            </svg>
          )}
          {error && (
            <div
              role="alert"
              className="absolute inset-0 flex items-center justify-center bg-[#101d26]/95 p-4 text-center text-xs text-[#edc7b5]"
            >
              {error}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 px-3 py-2 text-[10px] text-[#c4d1cc]">
          <span className="flex items-center gap-1.5">
            <Camera className="h-3 w-3" />
            {recording
              ? "Recording playback"
              : simulation
                ? paused
                  ? "Simulation paused"
                  : "Simulation playing"
                : "No footage available"}
          </span>
          <span
            aria-label={
              focused ? "CCTV playback time" : `${camera.id} playback time`
            }
            className="font-mono"
          >
            {formatPlaybackTime(seconds)}
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-1 border-t border-white/10 px-3 py-2 text-[10px] text-[#b9e7d0]">
          <span data-testid="face-detection-status">{aiLabel}</span>
          {recording && frame && (
            <span className="text-[#a1b2ac]">
              Sample {formatPlaybackTime(frame.sourceTime)} ·{" "}
              {frame.inferenceMs} ms
            </span>
          )}
        </div>
        {focused && recording && (
          <p className="break-all border-t border-white/10 px-3 py-2 text-[10px] text-paper/60">
            {recording.name}
          </p>
        )}
      </div>
    );
  },
);
export default CCTVCameraFeed;
