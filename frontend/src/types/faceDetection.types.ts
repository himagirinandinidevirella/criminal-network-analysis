/** Normalized frame coordinates; deliberately no identity, embedding, or tracking ID. */
export interface FaceBox {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}
export interface FaceDetectionFrame {
  boxes: FaceBox[];
  sourceTime: number;
  width: number;
  height: number;
  inferenceMs: number;
}
export type FaceModelStatus = "off" | "loading" | "ready" | "error";
export interface FaceModelState {
  status: FaceModelStatus;
  backend?: string;
  error?: string;
}
export interface CameraDetectionState {
  sourceKey: string;
  status: "off" | "waiting" | "scanning" | "ready" | "error";
  frame: FaceDetectionFrame | null;
  error?: string;
}
