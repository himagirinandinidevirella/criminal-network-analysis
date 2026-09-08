import type { CCTVCamera } from "@/types/cctv.types";
import { formatPlaybackTime } from "./cctvUtils";

const W = 960,
  H = 540;
function rect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}
function vehicle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  angle = 0,
  length = 58,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  rect(ctx, -length / 2 + 4, -12, length, 30, "#111c26");
  rect(ctx, -length / 2, -16, length, 28, color);
  rect(ctx, length / 2 - 15, -12, 9, 20, "#223541");
  rect(ctx, -length / 2 + 9, -12, 7, 20, "#344852");
  rect(ctx, length / 2 - 2, -13, 3, 5, "#e5cf8b");
  rect(ctx, length / 2 - 2, 5, 3, 5, "#e5cf8b");
  ctx.restore();
}
function building(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  rect(ctx, x + 12, y + 12, w, h, "#1d2c33");
  rect(ctx, x, y, w, h, "#546268");
  rect(ctx, x + 8, y + 8, w - 16, h - 16, "#46555b");
  ctx.strokeStyle = "#617278";
  ctx.lineWidth = 1;
  for (let i = x + 20; i < x + w - 5; i += 28) {
    ctx.beginPath();
    ctx.moveTo(i, y + 8);
    ctx.lineTo(i, y + h - 8);
    ctx.stroke();
  }
}

/** A diagrammatic scene, intentionally NOT photographic or described as live footage. */
export function drawCCTVSimulation(
  ctx: CanvasRenderingContext2D,
  camera: CCTVCamera,
  seconds: number,
): void {
  ctx.clearRect(0, 0, W, H);
  rect(ctx, 0, 0, W, H, "#33484b");
  if (camera.scene === "junction") {
    building(ctx, 42, 52, 290, 94);
    building(ctx, 614, 42, 270, 108);
    building(ctx, 66, 382, 270, 115);
    building(ctx, 606, 374, 300, 116);
    rect(ctx, 0, 166, W, 192, "#768078");
    rect(ctx, 365, 0, 220, H, "#768078");
    rect(ctx, 0, 178, W, 168, "#26363f");
    rect(ctx, 377, 0, 196, H, "#26363f");
    ctx.strokeStyle = "#adb3a0";
    ctx.lineWidth = 2;
    ctx.setLineDash([20, 20]);
    for (const [a, b, c, d] of [
      [0, 260, 355, 260],
      [596, 260, W, 260],
      [474, 0, 474, 160],
      [474, 361, 474, H],
    ]) {
      ctx.beginPath();
      ctx.moveTo(a, b);
      ctx.lineTo(c, d);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    for (let i = 0; i < 7; i++) {
      rect(ctx, 332, 185 + i * 22, 24, 11, "#a5ada4");
      rect(ctx, 597, 185 + i * 22, 24, 11, "#a5ada4");
    }
    vehicle(ctx, ((seconds * 38 + 150) % 1120) - 80, 297, "#b5c8bc");
    vehicle(ctx, 1040 - ((seconds * 31 + 510) % 1120), 220, "#bb9470", Math.PI);
    vehicle(
      ctx,
      424,
      ((seconds * 26 + 290) % 720) - 90,
      "#7cabb0",
      Math.PI / 2,
    );
    vehicle(
      ctx,
      526,
      610 - ((seconds * 19 + 40) % 720),
      "#97a6ac",
      -Math.PI / 2,
    );
  } else {
    rect(ctx, 28, 36, 906, 470, "#60716d");
    building(ctx, 130, 72, 665, 166);
    for (let i = 0; i < 5; i++) {
      rect(ctx, 183 + i * 114, 208, 75, 32, "#172c33");
      rect(ctx, 180 + i * 114, 251, 82, 10, "#c5b788");
      rect(ctx, 180 + i * 114, 270, 2, 73, "#a9b1a0");
      rect(ctx, 260 + i * 114, 270, 2, 73, "#a9b1a0");
    }
    rect(ctx, 42, 383, 875, 72, "#2a3c43");
    ctx.strokeStyle = "#a8b3a5";
    ctx.lineWidth = 2;
    ctx.setLineDash([18, 22]);
    ctx.beginPath();
    ctx.moveTo(50, 419);
    ctx.lineTo(915, 419);
    ctx.stroke();
    ctx.setLineDash([]);
    for (let i = 48; i < 925; i += 28) rect(ctx, i, 480, 3, 17, "#1e3337");
    rect(ctx, 48, 482, 872, 2, "#9aaba0");
    vehicle(ctx, ((seconds * 24 + 230) % 1050) - 70, 401, "#b3c0b1", 0, 85);
    vehicle(
      ctx,
      714,
      305 + Math.sin(seconds / 4) * 22,
      "#bda777",
      Math.PI / 2,
      43,
    );
    vehicle(ctx, 220, 302, "#91a5a6", -Math.PI / 2, 80);
  }
  // Fine scan lines and framing are visual treatment, not a camera-health signal.
  for (let y = 0; y < H; y += 4) rect(ctx, 0, y, W, 1, "rgba(6,15,22,.10)");
  const shade = ctx.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, 600);
  shade.addColorStop(0, "rgba(5,15,23,0)");
  shade.addColorStop(1, "rgba(5,15,23,.40)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, W, H);
  rect(ctx, 0, 0, W, 40, "rgba(9,20,29,.85)");
  rect(ctx, 0, H - 38, W, 38, "rgba(9,20,29,.85)");
  ctx.font = "13px monospace";
  ctx.fillStyle = "#ddece0";
  ctx.fillText(`${camera.id}  /  ${camera.name.toUpperCase()}`, 20, 25);
  ctx.fillStyle = "#edd7a5";
  ctx.fillText("SIMULATED · NOT LIVE", 713, 25);
  ctx.fillStyle = "#b9c9c5";
  ctx.fillText("FICTIONAL SCENE / NO PERSON IDENTIFICATION", 20, H - 14);
  ctx.fillText(`SIM ${formatPlaybackTime(seconds)}`, 815, H - 14);
}

/** Capture only the current frame; never upload or persist image bytes. */
export async function captureCCTVFrame(
  source: HTMLCanvasElement | HTMLVideoElement,
  label: string,
  seconds: number,
  simulated: boolean,
): Promise<Blob> {
  const isVideo = source instanceof HTMLVideoElement;
  const width = isVideo ? source.videoWidth : source.width;
  const height = isVideo ? source.videoHeight : source.height;
  if (!width || !height || (isVideo && source.readyState < 2))
    throw new Error("Wait for a video frame before taking a snapshot.");
  const scale = Math.min(1, 1280 / width, 720 / height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale) + 58;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser could not create a snapshot.");
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height - 58);
  ctx.fillStyle = "#17252e";
  ctx.fillRect(0, canvas.height - 58, canvas.width, 58);
  ctx.fillStyle = "#f5f1e8";
  ctx.font = `${Math.max(8, Math.min(13, canvas.width / 65))}px monospace`;
  ctx.fillText(
    `${label.slice(0, 70)} · ${formatPlaybackTime(seconds)}`,
    12,
    canvas.height - 34,
    canvas.width - 24,
  );
  ctx.fillStyle = "#d7ba86";
  ctx.fillText(
    simulated
      ? "SYNTHETIC DEMO · NOT A LIVE CAMERA · MANUAL SNAPSHOT"
      : "LOCAL RECORDING · MANUAL SNAPSHOT · NOT A CERTIFIED RECORD",
    12,
    canvas.height - 13,
    canvas.width - 24,
  );
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Snapshot creation failed.")),
      "image/png",
    ),
  );
}
