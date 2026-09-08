import { IS_DEMO } from "@/config/runtime";
import { get, post } from "./api";
import type { Alert } from "@/types/alert.types";
import type { CCTVCamera, CCTVReviewRequest } from "@/types/cctv.types";

/** Production has no configured camera gateway. Never substitute demo feeds there. */
export function getCCTVCameras(): Promise<CCTVCamera[]> {
  return IS_DEMO
    ? get<CCTVCamera[]>("/api/demo/cctv/cameras")
    : Promise.resolve([]);
}
export function flagCCTVForReview(request: CCTVReviewRequest): Promise<Alert> {
  if (!IS_DEMO)
    return Promise.reject(
      new Error("CCTV review alerts require a configured backend integration."),
    );
  return post<Alert>("/api/demo/cctv/flag", request);
}
