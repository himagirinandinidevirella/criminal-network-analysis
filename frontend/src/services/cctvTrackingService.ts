import { get, post } from "./api";
import type {
  CCTVMomentRequest,
  CCTVTrackingTrail,
} from "@/types/cctvTracking.types";

const base = "/api/demo/cctv/trails";
export const listCameraTrails = () => get<CCTVTrackingTrail[]>(base);
export const createCameraTrail = (title: string, moment?: CCTVMomentRequest) =>
  post<CCTVTrackingTrail>(base, { title, moment });
export const addCameraMoment = (id: string, moment: CCTVMomentRequest) =>
  post<CCTVTrackingTrail>(`${base}/${encodeURIComponent(id)}/moments`, moment);
export const reorderCameraMoments = (id: string, moment_ids: string[]) =>
  post<CCTVTrackingTrail>(`${base}/${encodeURIComponent(id)}/reorder`, {
    moment_ids,
  });
export const removeCameraMoment = (id: string, moment_id: string) =>
  post<CCTVTrackingTrail>(`${base}/${encodeURIComponent(id)}/remove-moment`, {
    moment_id,
  });
export const deleteCameraTrail = (id: string) =>
  post<{ deleted: string }>(`${base}/${encodeURIComponent(id)}/delete`, {
    confirm: true,
  });
