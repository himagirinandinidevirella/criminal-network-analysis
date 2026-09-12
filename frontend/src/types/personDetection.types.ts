export interface PersonBox {
  x: number;
  y: number;
  width: number;
  height: number;
  score: number;
}

export interface PersonDetectionFrame {
  boxes: PersonBox[];
  sourceTime: number;
  width: number;
  height: number;
  inferenceMs: number;
}

export interface CameraPersonDetectionState {
  sourceKey: string;
  status: "idle" | "ready" | "error";
  frame: PersonDetectionFrame | null;
  error?: string;
}
