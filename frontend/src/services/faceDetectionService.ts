/** Local, opt-in face bounding-box inference. No face recognition, embeddings or uploads. */
import type { FaceDetectionFrame } from "@/types/faceDetection.types";
import {
  detectionFrameSize,
  normalizeFaceBoxes,
} from "@/utils/faceDetectionUtils";

type FaceApi = typeof import("@vladmandic/face-api");
let engine: Promise<{ api: FaceApi; backend: string }> | null = null;
let inferenceQueue: Promise<void> = Promise.resolve();

function getEngine() {
  engine ??= (async () => {
    const api = await import("@vladmandic/face-api");
    // Backend methods are present in bundled TFJS but omitted from the upstream .d.ts.
    const tf = api.tf as typeof api.tf & {
      setBackend(name: string): Promise<boolean>;
      ready(): Promise<void>;
      getBackend(): string;
    };
    try {
      if (!(await tf.setBackend("webgl"))) throw new Error("WebGL unavailable");
      await tf.ready();
    } catch {
      await tf.setBackend("cpu");
      await tf.ready();
    }
    try {
      await api.nets.tinyFaceDetector.loadFromUri("/models/face-detector");
    } catch (error) {
      if (api.nets.tinyFaceDetector.isLoaded)
        api.nets.tinyFaceDetector.dispose();
      throw error;
    }
    return { api, backend: tf.getBackend() };
  })().catch((error) => {
    engine = null;
    throw error;
  });
  return engine;
}

export async function loadFaceDetector(): Promise<{ backend: string }> {
  const loaded = await getEngine();
  return { backend: loaded.backend };
}

function checkAbort(signal: AbortSignal) {
  if (signal.aborted)
    throw new DOMException("Face detection cancelled", "AbortError");
}

/** Serialize all cameras through one model. Capture each frame only when its turn starts. */
export function detectVideoFaces(
  video: HTMLVideoElement,
  threshold: number,
  signal: AbortSignal,
): Promise<FaceDetectionFrame> {
  const task = inferenceQueue.then(async () => {
    checkAbort(signal);
    const { api, backend } = await getEngine();
    checkAbort(signal);
    if (
      video.readyState < 2 ||
      video.seeking ||
      !video.videoWidth ||
      !video.videoHeight
    )
      throw new DOMException("Frame not ready", "AbortError");
    const size = detectionFrameSize(video.videoWidth, video.videoHeight);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext("2d");
    if (!ctx)
      throw new Error("This browser cannot read a frame for detection.");
    const sourceTime = video.currentTime;
    ctx.drawImage(video, 0, 0, size.width, size.height);
    const started = performance.now();
    const detections = await api.detectAllFaces(
      canvas,
      new api.TinyFaceDetectorOptions({
        inputSize: backend === "cpu" ? 320 : 416,
        scoreThreshold: Math.max(0.3, Math.min(0.95, threshold)),
      }),
    );
    checkAbort(signal);
    return {
      boxes: normalizeFaceBoxes(detections, size.width, size.height),
      sourceTime,
      width: video.videoWidth,
      height: video.videoHeight,
      inferenceMs: Math.round(performance.now() - started),
    };
  });
  inferenceQueue = task.then(
    () => undefined,
    () => undefined,
  );
  return task;
}
