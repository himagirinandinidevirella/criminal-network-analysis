import type { CCTVCamera, CCTVCameraStatus } from "@/types/cctv.types";

export const MAX_CCTV_RECORDING_BYTES = 100 * 1024 * 1024;
export const LOCAL_CCTV_SOURCE = "local-recording";

export function formatPlaybackTime(value: number): string {
  const seconds = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  const pad = (n: number) => String(n).padStart(2, "0");
  const time = `${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}`;
  return seconds >= 3600 ? `${pad(Math.floor(seconds / 3600))}:${time}` : time;
}

export function filterCCTVCameras(
  cameras: CCTVCamera[],
  query: string,
  status: CCTVCameraStatus | "ALL",
): CCTVCamera[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return cameras.filter(
    (camera) =>
      (status === "ALL" || camera.status === status) &&
      terms.every((term) =>
        `${camera.id} ${camera.name} ${camera.location}`
          .toLowerCase()
          .includes(term),
      ),
  );
}

/** Metadata checks only. The browser decoder must still validate the actual video. */
export function validateCCTVRecording(
  file: Pick<File, "name" | "type" | "size">,
): string | null {
  if (!file.size)
    return "This recording is empty. Choose a non-empty MP4 or WebM file.";
  if (file.size > MAX_CCTV_RECORDING_BYTES)
    return "Choose a recording of 100 MB or less.";
  if (
    !/\.(mp4|webm)$/i.test(file.name) ||
    (file.type &&
      !["video/mp4", "video/webm", "application/octet-stream"].includes(
        file.type,
      ))
  ) {
    return "Unsupported recording. Choose an MP4 or WebM video.";
  }
  return null;
}
