import * as tf from "@tensorflow/tfjs";
import * as cocoSsd from "@tensorflow-models/coco-ssd";
import type { PersonDetectionFrame } from "@/types/personDetection.types";

let engine: Promise<cocoSsd.ObjectDetection> | null = null;
let inferenceQueue: Promise<void> = Promise.resolve();

function getEngine() {
  engine ??= (async () => {
    try {
      await tf.ready();
      // Load the model locally using the base configuration
      const model = await cocoSsd.load({ base: "lite_mobilenet_v2" });
      return model;
    } catch (error) {
      engine = null;
      throw error;
    }
  })();
  return engine;
}

export async function loadPersonDetector(): Promise<{ loaded: boolean }> {
  await getEngine();
  return { loaded: true };
}

function checkAbort(signal: AbortSignal) {
  if (signal.aborted) {
    throw new DOMException("Person detection cancelled", "AbortError");
  }
}

/** Serialize all cameras through one model instance. */
export function detectVideoPersons(
  video: HTMLVideoElement,
  threshold: number,
  signal: AbortSignal
): Promise<PersonDetectionFrame> {
  const task = inferenceQueue.then(async () => {
    checkAbort(signal);
    const model = await getEngine();
    checkAbort(signal);
    if (
      video.readyState < 2 ||
      video.seeking ||
      !video.videoWidth ||
      !video.videoHeight
    ) {
      throw new DOMException("Frame not ready", "AbortError");
    }

    const sourceTime = video.currentTime;
    const started = performance.now();
    
    // coco-ssd detect handles video element natively
    const predictions = await model.detect(video);
    
    checkAbort(signal);
    
    const personBoxes = predictions
      .filter((p) => p.class === "person" && p.score >= threshold)
      .map((p) => ({
        x: p.bbox[0],
        y: p.bbox[1],
        width: p.bbox[2],
        height: p.bbox[3],
        score: p.score,
      }));

    return {
      boxes: personBoxes,
      sourceTime,
      width: video.videoWidth,
      height: video.videoHeight,
      inferenceMs: Math.round(performance.now() - started),
    };
  });
  
  inferenceQueue = task.then(
    () => undefined,
    () => undefined
  );
  
  return task;
}
