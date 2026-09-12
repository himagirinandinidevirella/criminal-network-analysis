import type {
  CCTVMomentRequest,
  CCTVTrackingTrail,
  CCTVTrackingMoment
} from "@/types/cctvTracking.types";

let trailsStore: CCTVTrackingTrail[] = [];

export const listCameraTrails = (): Promise<CCTVTrackingTrail[]> =>
  Promise.resolve(trailsStore);

export const createCameraTrail = (
  title: string,
  moment?: CCTVMomentRequest
): Promise<CCTVTrackingTrail> => {
  const newTrail: CCTVTrackingTrail = {
    id: `trail-${Date.now()}`,
    title,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    moments: moment ? [{ ...moment, id: `moment-${Date.now()}` } as unknown as CCTVTrackingMoment] : [],
  };
  trailsStore.push(newTrail);
  return Promise.resolve(newTrail);
};

export const addCameraMoment = (
  id: string,
  moment: CCTVMomentRequest
): Promise<CCTVTrackingTrail> => {
  const trail = trailsStore.find((t) => t.id === id);
  if (!trail) return Promise.reject(new Error("Trail not found"));
  const updatedTrail: CCTVTrackingTrail = {
    ...trail,
    updated_at: new Date().toISOString(),
    moments: [...trail.moments, { ...moment, id: `moment-${Date.now()}` } as unknown as CCTVTrackingMoment],
  };
  trailsStore = trailsStore.map((t) => (t.id === id ? updatedTrail : t));
  return Promise.resolve(updatedTrail);
};

export const reorderCameraMoments = (
  id: string,
  moment_ids: string[]
): Promise<CCTVTrackingTrail> => {
  const trail = trailsStore.find((t) => t.id === id);
  if (!trail) return Promise.reject(new Error("Trail not found"));
  const newMoments = moment_ids
    .map((mid) => trail.moments.find((m) => m.id === mid)!)
    .filter(Boolean);
  const updatedTrail: CCTVTrackingTrail = {
    ...trail,
    updated_at: new Date().toISOString(),
    moments: newMoments,
  };
  trailsStore = trailsStore.map((t) => (t.id === id ? updatedTrail : t));
  return Promise.resolve(updatedTrail);
};

export const removeCameraMoment = (
  id: string,
  moment_id: string
): Promise<CCTVTrackingTrail> => {
  const trail = trailsStore.find((t) => t.id === id);
  if (!trail) return Promise.reject(new Error("Trail not found"));
  const updatedTrail: CCTVTrackingTrail = {
    ...trail,
    updated_at: new Date().toISOString(),
    moments: trail.moments.filter((m) => m.id !== moment_id),
  };
  trailsStore = trailsStore.map((t) => (t.id === id ? updatedTrail : t));
  return Promise.resolve(updatedTrail);
};

export const deleteCameraTrail = (
  id: string
): Promise<{ deleted: string }> => {
  trailsStore = trailsStore.filter((t) => t.id !== id);
  return Promise.resolve({ deleted: id });
};
