import type { FaceBox } from "@/types/faceDetection.types";

/** Scale detector rectangles to [0,1], clipping out-of-frame results. */
export function normalizeFaceBoxes(
  detections: Array<{
    box: { x: number; y: number; width: number; height: number };
    score: number;
  }>,
  frameWidth: number,
  frameHeight: number,
): FaceBox[] {
  if (
    !Number.isFinite(frameWidth) ||
    !Number.isFinite(frameHeight) ||
    frameWidth <= 0 ||
    frameHeight <= 0
  )
    return [];
  const clamp = (value: number) => Math.min(1, Math.max(0, value));
  return detections.flatMap(({ box, score }) => {
    if (
      ![box.x, box.y, box.width, box.height, score].every(Number.isFinite) ||
      box.width <= 0 ||
      box.height <= 0
    )
      return [];
    const x = clamp(box.x / frameWidth),
      y = clamp(box.y / frameHeight);
    const right = clamp((box.x + box.width) / frameWidth),
      bottom = clamp((box.y + box.height) / frameHeight);
    return right > x && bottom > y
      ? [
          {
            x,
            y,
            width: right - x,
            height: bottom - y,
            confidence: clamp(score),
          },
        ]
      : [];
  });
}

/** Bounded inference work: every frame is downscaled, never stretched. */
export function detectionFrameSize(width: number, height: number) {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  )
    throw new Error("Video dimensions are unavailable");
  const scale = Math.min(1, 416 / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}
