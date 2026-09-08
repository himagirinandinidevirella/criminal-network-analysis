/** CCTV demo metadata. A configured camera is not proof of a live connection. */
export type CCTVCameraStatus = "AVAILABLE" | "OFFLINE" | "MAINTENANCE";
export interface CCTVCamera {
  id: string;
  name: string;
  location: string;
  status: CCTVCameraStatus;
  scene: "junction" | "warehouse";
  notice: string;
}
export interface CCTVReviewTarget {
  camera_id: string;
  view_id?: string;
  label: string;
  playback_seconds: number;
}
export interface CCTVReviewRequest {
  camera_id: string;
  view_id?: string;
  playback_seconds: number;
  note: string;
  severity: "MEDIUM" | "HIGH";
}
