import type { FaceBox } from "@/types/faceDetection.types";
import { formatPlaybackTime } from "./cctvUtils";

export interface CCTVSnapshotTile {
  label: string;
  sourceLabel: string;
  source: HTMLCanvasElement | HTMLVideoElement | null;
  seconds: number;
  boxes?: FaceBox[];
}

/** A real 2x2 composite of the current frames, NOT a stitched 360-degree reconstruction. */
export async function captureCCTVWall(
  tiles: CCTVSnapshotTile[],
): Promise<Blob> {
  if (tiles.length > 4)
    throw new Error("The combined view supports four cameras");
  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 768;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable in this browser");
  ctx.fillStyle = "#101d26";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  tiles.forEach((tile, index) => {
    const x = (index % 2) * 640,
      y = Math.floor(index / 2) * 360;
    const source = tile.source;
    const w =
      source instanceof HTMLVideoElement
        ? source.videoWidth
        : (source?.width ?? 0);
    const h =
      source instanceof HTMLVideoElement
        ? source.videoHeight
        : (source?.height ?? 0);
    if (
      source &&
      w &&
      h &&
      (!(source instanceof HTMLVideoElement) || source.readyState >= 2)
    ) {
      const scale = Math.min(640 / w, 304 / h);
      const width = w * scale,
        height = h * scale;
      const left = x + (640 - width) / 2,
        top = y + 36 + (304 - height) / 2;
      ctx.drawImage(source, left, top, width, height);
      ctx.strokeStyle = "#71edb3";
      ctx.lineWidth = 2;
      for (const box of tile.boxes ?? [])
        ctx.strokeRect(
          left + box.x * width,
          top + box.y * height,
          box.width * width,
          box.height * height,
        );
    } else {
      ctx.fillStyle = "#9eaeac";
      ctx.font = "16px monospace";
      ctx.fillText("NO FOOTAGE AVAILABLE", x + 208, y + 192);
    }
    ctx.fillStyle = "#1c3039";
    ctx.fillRect(x, y, 640, 36);
    ctx.fillRect(x, y + 340, 640, 20);
    ctx.fillStyle = "#f5f1e8";
    ctx.font = "13px monospace";
    ctx.fillText(tile.label.slice(0, 65), x + 12, y + 23, 616);
    ctx.fillStyle = "#d7ca99";
    ctx.font = "11px monospace";
    ctx.fillText(
      `${tile.sourceLabel} · ${formatPlaybackTime(tile.seconds)}`,
      x + 12,
      y + 355,
      616,
    );
    ctx.strokeStyle = "#4a6064";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, 640, 360);
  });
  ctx.fillStyle = "#14232c";
  ctx.fillRect(0, 720, 1280, 48);
  ctx.fillStyle = "#eed9a3";
  ctx.font = "12px monospace";
  ctx.fillText(
    "CRIMENET · MANUAL COMBINED SNAPSHOT · INDEPENDENT SOURCES / NOT A SYNCHRONISED OR CERTIFIED RECORD",
    16,
    740,
  );
  ctx.fillText(
    "Face boxes are detections only, not identities. Illustrations and AI sample clips are synthetic. No footage was uploaded.",
    16,
    758,
  );
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("Could not create combined snapshot")),
      "image/png",
    ),
  );
}
