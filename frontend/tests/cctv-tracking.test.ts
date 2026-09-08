import axios from "axios";
import { beforeEach, describe, expect, it } from "vitest";
import { createDemoAdapter } from "@/demo/adapter";
import { DEMO_CCTV_CAMERAS } from "@/demo/cctv";
import { DEMO_STORAGE_KEY, DemoRepository } from "@/demo/store";
import { CCTVRecordingRegistry } from "@/utils/cctvRecordings";
import {
  canReplayMoment,
  cctvMomentSource,
  exportTrackingTrail,
  MAX_CCTV_TRAILS,
  MAX_TRAIL_MOMENTS,
  moveMomentIds,
  trackingRoute,
} from "@/utils/cctvTrackingUtils";
import type { CCTVTrackingTrail } from "@/types/cctvTracking.types";
import { MemoryStorage } from "./setup";

let storage: MemoryStorage;
let repo: DemoRepository;
let api: ReturnType<typeof axios.create>;
const base = "/api/demo/cctv/trails";
const moment = (camera_id = "CAM-01", playback_seconds = 30) => ({
  camera_id,
  playback_seconds,
  source_kind: "simulation",
  source_instance: `simulation:${camera_id}:v1`,
  note: "Operator recorded a fictional event.",
  manual_association: true,
});
const create = async () =>
  (await api.post(base, { title: "Synthetic event review", moment: moment() }))
    .data.data as CCTVTrackingTrail;
beforeEach(() => {
  storage = new MemoryStorage();
  repo = new DemoRepository(storage);
  api = axios.create({
    adapter: createDemoAdapter(repo),
    headers: { Authorization: "Bearer demo-access-admin" },
  });
});

describe("manual cross-camera trails", () => {
  it("adds tracking storage to older caches without deleting notes or other records", async () => {
    const legacy = repo.read();
    delete legacy.cctv_trails;
    legacy.notes.push({
      id: "existing",
      criminal_id: "raja-khan",
      content: "Keep this note",
      officer: "Demo",
      created_at: new Date().toISOString(),
    });
    storage.setItem(DEMO_STORAGE_KEY, JSON.stringify(legacy));
    expect((await api.get(base)).data.data).toEqual([]);
    expect(repo.read().notes[0].content).toBe("Keep this note");
    expect(repo.read().people).toHaveLength(40);
    storage.setItem(
      DEMO_STORAGE_KEY,
      JSON.stringify({ ...legacy, cctv_trails: "invalid" }),
    );
    expect(repo.read().cctv_trails).toEqual([]);
    expect(repo.read().notes[0].content).toBe("Keep this note");
  });
  it("creates linked camera moments without inferring identities or synchronising clocks", async () => {
    const first = await create();
    const trail = (
      await api.post(`${base}/${first.id}/moments`, {
        ...moment("CAM-02", 4),
        person_id: "not-allowed",
        descriptor: [1, 2, 3],
        source_url: "blob:private",
      })
    ).data.data as CCTVTrackingTrail;
    expect(trail.moments.map((m) => m.playback_seconds)).toEqual([30, 4]);
    expect(trackingRoute(trail.moments)).toEqual(["CAM-01", "CAM-02"]);
    expect(
      trail.moments.every((m) => m.association === "MANUAL_UNVERIFIED"),
    ).toBe(true);
    expect(trail.moments[1]).not.toHaveProperty("person_id");
    expect(trail.moments[1]).not.toHaveProperty("descriptor");
    expect(trail.moments[1]).not.toHaveProperty("source_url");
    expect(repo.read().evidence).toHaveLength(0);
    expect(repo.read().cctv_trails?.[0]).toEqual(trail);
    const exported = exportTrackingTrail(trail);
    expect(exported.notice).toContain("not face matching");
    expect(exported.trail.moments[0]).not.toHaveProperty("source_instance");
  });
  it("requires authentication and explicit manual confirmation, and creates no partial records", async () => {
    await expect(
      api.get(base, { headers: { Authorization: "" } }),
    ).rejects.toMatchObject({ response: { status: 401 } });
    await expect(
      api.post(base, {
        title: "My trail",
        moment: { ...moment(), manual_association: false },
      }),
    ).rejects.toThrow("Confirm");
    expect(repo.read().cctv_trails).toEqual([]);
    for (const fields of [
      { camera_id: "missing" },
      { camera_id: "CAM-03" },
      { playback_seconds: -1 },
      { playback_seconds: "20" },
      { playback_seconds: 604801 },
      { note: " " },
      { note: "x".repeat(501) },
      { source_instance: "blob:actual/url" },
      { source_kind: "identity-match" },
    ]) {
      await expect(
        api.post(base, {
          title: "My trail",
          moment: { ...moment(), ...fields },
        }),
      ).rejects.toThrow();
    }
    expect(repo.read().cctv_trails).toEqual([]);
  });
  it("reorders the exact current moment list and rejects duplicate/stale orders atomically", async () => {
    let trail = await create();
    trail = (await api.post(`${base}/${trail.id}/moments`, moment("CAM-02")))
      .data.data;
    const original = structuredClone(trail);
    await expect(
      api.post(`${base}/${trail.id}/reorder`, {
        moment_ids: [trail.moments[0].id, trail.moments[0].id],
      }),
    ).rejects.toMatchObject({ response: { status: 409 } });
    expect(repo.read().cctv_trails?.[0]).toEqual(original);
    const ids = moveMomentIds(trail.moments, trail.moments[1].id, -1);
    trail = (await api.post(`${base}/${trail.id}/reorder`, { moment_ids: ids }))
      .data.data;
    expect(trackingRoute(trail.moments)).toEqual(["CAM-02", "CAM-01"]);
    expect(moveMomentIds(trail.moments, trail.moments[0].id, -1)).toEqual(ids);
    await expect(
      api.post(`${base}/${trail.id}/reorder`, { moment_ids: [] }),
    ).rejects.toMatchObject({ response: { status: 409 } });
  });
  it("bounds both trails and moments without silently dropping saved data", async () => {
    let trail = await create();
    repo.update((state) => {
      state.cctv_trails![0].moments = Array.from(
        { length: MAX_TRAIL_MOMENTS },
        (_, i) => ({ ...trail.moments[0], id: `moment-${i}` }),
      );
    });
    await expect(
      api.post(`${base}/${trail.id}/moments`, moment("CAM-02")),
    ).rejects.toThrow("up to 50");
    expect(repo.read().cctv_trails![0].moments).toHaveLength(MAX_TRAIL_MOMENTS);
    repo.update((state) => {
      state.cctv_trails = Array.from({ length: MAX_CCTV_TRAILS }, (_, i) => ({
        ...trail,
        id: `trail-${i}`,
      }));
    });
    await expect(api.post(base, { title: "One too many" })).rejects.toThrow(
      "up to 12",
    );
    expect(repo.read().cctv_trails).toHaveLength(MAX_CCTV_TRAILS);
  });
  it("supports moment removal, confirmed trail deletion and workspace reset", async () => {
    let trail = await create();
    trail = (
      await api.post(`${base}/${trail.id}/remove-moment`, {
        moment_id: trail.moments[0].id,
      })
    ).data.data;
    expect(trail.moments).toEqual([]);
    await expect(api.post(`${base}/${trail.id}/delete`, {})).rejects.toThrow(
      "Confirm",
    );
    await api.post(`${base}/${trail.id}/delete`, { confirm: true });
    expect((await api.get(base)).data.data).toEqual([]);
    await create();
    await api.post("/api/demo/reset", {});
    expect((await api.get(base)).data.data).toEqual([]);
  });
  it("rejects unknown trails and moments instead of faking success", async () => {
    await expect(
      api.post(`${base}/missing/moments`, moment()),
    ).rejects.toMatchObject({ response: { status: 404 } });
    const trail = await create();
    await expect(
      api.post(`${base}/${trail.id}/remove-moment`, { moment_id: "missing" }),
    ).rejects.toMatchObject({ response: { status: 404 } });
  });
  it("enables jump only for the exact media instance, never a same-named replacement", async () => {
    const registry = new CCTVRecordingRegistry();
    const camera = DEMO_CCTV_CAMERAS[0];
    const file = new File(["metadata only"], "same-name.webm", {
      type: "video/webm",
    });
    const first = registry.install([{ slotId: camera.id, file }])[camera.id];
    const trail = (
      await api.post(base, {
        title: "Local event",
        moment: { ...moment(), ...cctvMomentSource(camera, first) },
      })
    ).data.data as CCTVTrackingTrail;
    expect(canReplayMoment(trail.moments[0], camera, first)).toBe(true);
    expect(canReplayMoment(trail.moments[0], camera)).toBe(false);
    const replacement = registry.install([{ slotId: camera.id, file }])[
      camera.id
    ];
    expect(canReplayMoment(trail.moments[0], camera, replacement)).toBe(false);
    expect(canReplayMoment(trail.moments[0], undefined, first)).toBe(false);
    registry.dispose();
  });
});
