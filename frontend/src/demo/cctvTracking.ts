import type {
  CCTVTrackingMoment,
  CCTVTrackingTrail,
} from "@/types/cctvTracking.types";
import {
  MAX_CCTV_TRAILS,
  MAX_TRAIL_MOMENTS,
  SOURCE_LABELS,
} from "@/utils/cctvTrackingUtils";
import { DEMO_CCTV_CAMERAS } from "./cctv";
import { addAudit, type DemoRepository } from "./store";

export class CCTVTrackingError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}
function text(value: unknown, label: string, max: number) {
  if (
    typeof value !== "string" ||
    value.trim().length < 3 ||
    value.length > max
  )
    throw new CCTVTrackingError(
      `${label} must be between 3 and ${max} characters`,
    );
  return value.trim();
}
function validateMoment(raw: unknown): CCTVTrackingMoment {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new CCTVTrackingError("A captured moment is required");
  const body = raw as Record<string, unknown>;
  const camera = DEMO_CCTV_CAMERAS.find(
    (camera) => camera.id === body.camera_id,
  );
  if (!camera) throw new CCTVTrackingError("Camera not found", 404);
  const kind = String(body.source_kind);
  if (!Object.prototype.hasOwnProperty.call(SOURCE_LABELS, kind))
    throw new CCTVTrackingError("Invalid source kind");
  if (kind === "simulation" && camera.status !== "AVAILABLE")
    throw new CCTVTrackingError("This camera has no available simulation");
  if (
    typeof body.source_instance !== "string" ||
    !/^[a-zA-Z0-9:_-]{1,100}$/.test(body.source_instance)
  )
    throw new CCTVTrackingError("Invalid media reference");
  if (
    typeof body.playback_seconds !== "number" ||
    !Number.isFinite(body.playback_seconds) ||
    body.playback_seconds < 0 ||
    body.playback_seconds > 604800
  )
    throw new CCTVTrackingError("Invalid playback time");
  if (body.manual_association !== true)
    throw new CCTVTrackingError(
      "Confirm that this is a manual, unverified event association",
    );
  return {
    id: crypto.randomUUID(),
    camera_id: camera.id,
    camera_name: camera.name,
    source_kind: kind as CCTVTrackingMoment["source_kind"],
    source_instance: body.source_instance,
    playback_seconds: body.playback_seconds,
    note: text(body.note, "Moment note", 500),
    created_at: new Date().toISOString(),
    association: "MANUAL_UNVERIFIED",
  };
}

/** Auth is checked by the adapter before this handler. Every mutation is bounded and atomic. */
export function handleCCTVTracking(
  repo: DemoRepository,
  method: string,
  path: string,
  body: Record<string, unknown>,
  officer: string,
): unknown {
  if (path === "/api/demo/cctv/trails" && method === "GET")
    return repo.read().cctv_trails ?? [];
  if (path === "/api/demo/cctv/trails" && method === "POST") {
    const title = text(body.title, "Trail title", 80);
    const moment =
      body.moment === undefined ? null : validateMoment(body.moment);
    return repo.update((state) => {
      state.cctv_trails ??= [];
      if (state.cctv_trails.length >= MAX_CCTV_TRAILS)
        throw new CCTVTrackingError(
          `Keep up to ${MAX_CCTV_TRAILS} trails. Delete a trail before creating another.`,
        );
      const now = new Date().toISOString();
      const trail: CCTVTrackingTrail = {
        id: crypto.randomUUID(),
        title,
        created_at: now,
        updated_at: now,
        moments: moment ? [moment] : [],
      };
      state.cctv_trails.unshift(trail);
      addAudit(
        state,
        trail.id,
        "CCTV_TRAIL_CREATED",
        `${officer} created a manual camera event trail. No identities were inferred.`,
      );
      return trail;
    });
  }
  const match = path.match(
    /^\/api\/demo\/cctv\/trails\/([^/]+)\/(moments|reorder|remove-moment|delete)$/,
  );
  if (method !== "POST" || !match)
    throw new CCTVTrackingError("Tracking endpoint not found", 404);
  const [, id, action] = match;
  // Validate before starting the transaction; no partially-created trails/moments.
  const newMoment = action === "moments" ? validateMoment(body) : null;
  return repo.update((state) => {
    const trails = state.cctv_trails ?? [];
    const trail = trails.find((trail) => trail.id === id);
    if (!trail)
      throw new CCTVTrackingError(
        "Trail not found. Refresh the tracking panel.",
        404,
      );
    if (action === "moments") {
      if (trail.moments.length >= MAX_TRAIL_MOMENTS)
        throw new CCTVTrackingError(
          `A trail supports up to ${MAX_TRAIL_MOMENTS} moments`,
        );
      trail.moments.push(newMoment!);
    } else if (action === "reorder") {
      const ids = body.moment_ids;
      if (
        !Array.isArray(ids) ||
        ids.length !== trail.moments.length ||
        new Set(ids).size !== ids.length ||
        !ids.every((id) => trail.moments.some((moment) => moment.id === id))
      )
        throw new CCTVTrackingError(
          "Moment list changed or order is invalid. Refresh and try again.",
          409,
        );
      trail.moments = ids.map(
        (id) => trail.moments.find((moment) => moment.id === id)!,
      );
    } else if (action === "remove-moment") {
      if (!trail.moments.some((moment) => moment.id === body.moment_id))
        throw new CCTVTrackingError("Moment not found", 404);
      trail.moments = trail.moments.filter(
        (moment) => moment.id !== body.moment_id,
      );
    } else {
      if (body.confirm !== true)
        throw new CCTVTrackingError("Confirm trail deletion");
      state.cctv_trails = trails.filter((trail) => trail.id !== id);
      addAudit(
        state,
        id,
        "CCTV_TRAIL_DELETED",
        `${officer} removed a manual event trail.`,
      );
      return { deleted: id };
    }
    trail.updated_at = new Date().toISOString();
    addAudit(
      state,
      id,
      `CCTV_TRAIL_${action.toUpperCase().replace(/-/g, "_")}`,
      `${officer} updated a manually ordered event trail.`,
    );
    return trail;
  });
}
