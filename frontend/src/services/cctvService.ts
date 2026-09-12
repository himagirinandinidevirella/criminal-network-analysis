import type { Alert } from "@/types/alert.types";
import type { CCTVCamera, CCTVReviewRequest } from "@/types/cctv.types";
import { DEMO_CCTV_CAMERAS } from "@/demo/cctv";
import { formatPlaybackTime, LOCAL_CCTV_SOURCE } from "@/utils/cctvUtils";

/** Always use the dummy demo cameras for the CCTV Monitor. */
export function getCCTVCameras(): Promise<CCTVCamera[]> {
  return Promise.resolve(DEMO_CCTV_CAMERAS);
}

export function flagCCTVForReview(request: CCTVReviewRequest): Promise<Alert> {
  // Simulate successful flag response using dummy sample data
  const time = formatPlaybackTime(request.playback_seconds);
  const camera =
    request.camera_id === LOCAL_CCTV_SOURCE
      ? "Local Demo Recording"
      : (DEMO_CCTV_CAMERAS.find((c) => c.id === request.camera_id)?.name ??
        request.camera_id);

  return Promise.resolve({
    id: Date.now(),
    title: "CCTV Manual Flag",
    description: `Manual review requested for ${camera} at ${time}.\nNotes: ${request.note}`,
    severity: "MEDIUM",
    category: "INVESTIGATION",
    timestamp: new Date().toISOString(),
    status: "NEW",
    source: "CCTV_REVIEW",
  } as any); // cast to any to satisfy Alert type which might be deeper
}
