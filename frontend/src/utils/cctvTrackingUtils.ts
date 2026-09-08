import type { CCTVCamera } from "@/types/cctv.types";
import type {
  CCTVMomentSource,
  CCTVTrackingMoment,
  CCTVTrackingTrail,
} from "@/types/cctvTracking.types";
import type { CCTVRecording } from "./cctvRecordings";

export const MAX_CCTV_TRAILS = 12;
export const MAX_TRAIL_MOMENTS = 50;
export const TRACKING_NOTICE =
  "Manual, unverified event associations only. This is not face matching, person re-identification, or proof that moments show the same person or object. Playback clocks are independent; the review order is set by the operator. No footage or biometric data is stored.";
export const SOURCE_LABELS = {
  simulation: "Synthetic simulation",
  sample: "AI-generated test clip",
  local: "Local recording",
} as const;

/** Tokens identify a media instance, not a person. No blob URL or original filename is persisted. */
export function cctvMomentSource(
  camera: CCTVCamera,
  recording?: CCTVRecording,
): CCTVMomentSource | null {
  if (recording)
    return {
      source_kind: recording.kind,
      source_instance: recording.instance_id,
    };
  return camera.status === "AVAILABLE"
    ? {
        source_kind: "simulation",
        source_instance: `simulation:${camera.id}:v1`,
      }
    : null;
}
export function canReplayMoment(
  moment: CCTVTrackingMoment,
  camera: CCTVCamera | undefined,
  recording?: CCTVRecording,
): boolean {
  if (!camera) return false;
  const source = cctvMomentSource(camera, recording);
  return (
    source?.source_kind === moment.source_kind &&
    source.source_instance === moment.source_instance
  );
}
export function trackingRoute(moments: CCTVTrackingMoment[]): string[] {
  return moments
    .map((moment) => moment.camera_id)
    .filter((id, index, ids) => index === 0 || id !== ids[index - 1]);
}
export function moveMomentIds(
  moments: CCTVTrackingMoment[],
  id: string,
  direction: -1 | 1,
): string[] {
  const ids = moments.map((moment) => moment.id);
  const index = ids.indexOf(id),
    next = index + direction;
  if (index < 0 || next < 0 || next >= ids.length) return ids;
  [ids[index], ids[next]] = [ids[next], ids[index]];
  return ids;
}
export function exportTrackingTrail(trail: CCTVTrackingTrail) {
  return {
    format: "crimenet-manual-camera-trail-v1",
    notice: TRACKING_NOTICE,
    trail: {
      id: trail.id,
      title: trail.title,
      created_at: trail.created_at,
      updated_at: trail.updated_at,
      moments: trail.moments.map(
        ({ source_instance: _token, ...moment }, index) => ({
          order: index + 1,
          ...moment,
        }),
      ),
    },
  };
}

function isTrackingMoment(value: unknown): value is CCTVTrackingMoment {
  if (!value || typeof value !== "object") return false;
  const moment = value as Partial<CCTVTrackingMoment>;
  return (
    typeof moment.id === "string" &&
    typeof moment.camera_id === "string" &&
    typeof moment.camera_name === "string" &&
    typeof moment.note === "string" &&
    moment.note.length <= 500 &&
    typeof moment.source_kind === "string" &&
    Object.prototype.hasOwnProperty.call(SOURCE_LABELS, moment.source_kind) &&
    typeof moment.source_instance === "string" &&
    /^[a-zA-Z0-9:_-]{1,100}$/.test(moment.source_instance) &&
    typeof moment.playback_seconds === "number" &&
    Number.isFinite(moment.playback_seconds) &&
    moment.playback_seconds >= 0 &&
    moment.playback_seconds <= 604800 &&
    typeof moment.created_at === "string" &&
    Number.isFinite(Date.parse(moment.created_at)) &&
    moment.association === "MANUAL_UNVERIFIED"
  );
}

/** Additive cache migration: invalid tracking data must not erase unrelated notes/reports. */
export function sanitizeTrackingTrails(value: unknown): CCTVTrackingTrail[] {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((raw): CCTVTrackingTrail[] => {
      if (!raw || typeof raw !== "object") return [];
      const trail = raw as Partial<CCTVTrackingTrail>;
      if (
        typeof trail.id !== "string" ||
        typeof trail.title !== "string" ||
        trail.title.length > 80 ||
        typeof trail.created_at !== "string" ||
        !Number.isFinite(Date.parse(trail.created_at)) ||
        typeof trail.updated_at !== "string" ||
        !Number.isFinite(Date.parse(trail.updated_at)) ||
        !Array.isArray(trail.moments) ||
        trail.moments.length > MAX_TRAIL_MOMENTS ||
        !trail.moments.every(isTrackingMoment) ||
        new Set(trail.moments.map((moment) => moment.id)).size !==
          trail.moments.length
      )
        return [];
      // Whitelist fields rather than copying arbitrary cached data into the tracking model.
      return [
        {
          id: trail.id,
          title: trail.title,
          created_at: trail.created_at,
          updated_at: trail.updated_at,
          moments: trail.moments.map((moment) => ({
            id: moment.id,
            camera_id: moment.camera_id,
            camera_name: moment.camera_name,
            source_kind: moment.source_kind,
            source_instance: moment.source_instance,
            playback_seconds: moment.playback_seconds,
            note: moment.note,
            created_at: moment.created_at,
            association: "MANUAL_UNVERIFIED",
          })),
        },
      ];
    })
    .slice(0, MAX_CCTV_TRAILS);
}
