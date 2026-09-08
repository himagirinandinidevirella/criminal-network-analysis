import axios from "axios";
import { beforeEach, describe, expect, it } from "vitest";
import { DEMO_CCTV_CAMERAS } from "@/demo/cctv";
import { createDemoAdapter } from "@/demo/adapter";
import { DemoRepository } from "@/demo/store";
import { onDemoAlert } from "@/demo/events";
import {
  filterCCTVCameras,
  formatPlaybackTime,
  LOCAL_CCTV_SOURCE,
  MAX_CCTV_RECORDING_BYTES,
  validateCCTVRecording,
} from "@/utils/cctvUtils";
import { MemoryStorage } from "./setup";

let repo: DemoRepository;
let api: ReturnType<typeof axios.create>;
beforeEach(() => {
  repo = new DemoRepository(new MemoryStorage());
  api = axios.create({
    adapter: createDemoAdapter(repo),
    headers: { Authorization: "Bearer demo-access-admin" },
  });
});

describe("CCTV camera catalogue and helpers", () => {
  it("loads demo cameras without changing existing user data or graph counts", async () => {
    repo.update((state) => {
      state.notes.push({
        id: "existing",
        criminal_id: "raja-khan",
        content: "Keep my note",
        officer: "Demo",
        created_at: new Date().toISOString(),
      });
    });
    const cameras = (await api.get("/api/demo/cctv/cameras")).data.data;
    expect(cameras).toHaveLength(4);
    expect(
      cameras.filter(
        (camera: { status: string }) => camera.status === "AVAILABLE",
      ),
    ).toHaveLength(2);
    expect(repo.read().notes[0].content).toBe("Keep my note");
    expect(repo.read().people).toHaveLength(40);
    await expect(
      api.get("/api/demo/cctv/cameras", { headers: { Authorization: "" } }),
    ).rejects.toMatchObject({ response: { status: 401 } });
  });
  it("combines name/location/id and status filters without mutating the catalogue", () => {
    const before = structuredClone(DEMO_CCTV_CAMERAS);
    expect(
      filterCCTVCameras(DEMO_CCTV_CAMERAS, "cam-02 warehouse", "AVAILABLE").map(
        (camera) => camera.id,
      ),
    ).toEqual(["CAM-02"]);
    expect(
      filterCCTVCameras(DEMO_CCTV_CAMERAS, "sector c", "OFFLINE"),
    ).toHaveLength(1);
    expect(
      filterCCTVCameras(DEMO_CCTV_CAMERAS, "warehouse", "OFFLINE"),
    ).toHaveLength(0);
    expect(filterCCTVCameras(DEMO_CCTV_CAMERAS, "missing", "ALL")).toHaveLength(
      0,
    );
    expect(DEMO_CCTV_CAMERAS).toEqual(before);
  });
  it("formats seconds and hours, safely handling invalid inputs", () => {
    expect(formatPlaybackTime(0)).toBe("00:00");
    expect(formatPlaybackTime(65.9)).toBe("01:05");
    expect(formatPlaybackTime(3601)).toBe("01:00:01");
    expect(formatPlaybackTime(-8)).toBe("00:00");
    expect(formatPlaybackTime(Infinity)).toBe("00:00");
    expect(formatPlaybackTime(NaN)).toBe("00:00");
  });
  it("validates video file types, empty files and the 100 MB size cap", () => {
    expect(
      validateCCTVRecording({
        name: "demo.mp4",
        type: "video/mp4",
        size: 2000,
      }),
    ).toBeNull();
    expect(
      validateCCTVRecording({
        name: "DEMO.WEBM",
        type: "",
        size: MAX_CCTV_RECORDING_BYTES,
      }),
    ).toBeNull();
    expect(
      validateCCTVRecording({
        name: "demo.webm",
        type: "application/octet-stream",
        size: 2000,
      }),
    ).toBeNull();
    expect(
      validateCCTVRecording({ name: "demo.txt", type: "text/plain", size: 5 }),
    ).toContain("Unsupported");
    expect(
      validateCCTVRecording({ name: "empty.mp4", type: "video/mp4", size: 0 }),
    ).toContain("empty");
    expect(
      validateCCTVRecording({
        name: "big.mp4",
        type: "video/mp4",
        size: MAX_CCTV_RECORDING_BYTES + 1,
      }),
    ).toContain("100 MB");
  });
});

describe("manual CCTV review flags", () => {
  const request = {
    camera_id: "CAM-01",
    playback_seconds: 65.8,
    severity: "MEDIUM",
    note: "Review this fictional vehicle movement.",
  };
  it("persists a manual alert and publishes it once, without storing footage or identifying a person", async () => {
    const delivered: number[] = [];
    const unsubscribe = onDemoAlert((alert) => delivered.push(alert.id));
    try {
      const alert = (await api.post("/api/demo/cctv/flag", request)).data.data;
      expect(alert).toMatchObject({
        category: "CCTV",
        severity: "MEDIUM",
        source: "Manual CCTV review (demo)",
        criminal_id: null,
        criminal_name: null,
      });
      expect(alert.description).toContain("At 01:05");
      expect(alert.description).toContain("No automated identity matching");
      expect(delivered).toEqual([alert.id]);
      expect((await api.get("/api/alerts/active")).data.data).toHaveLength(6);
      expect(repo.read().audit[0].action).toBe("CCTV_REVIEW_FLAGGED");
      expect(repo.read().evidence).toHaveLength(0);
      expect(repo.read().alerts[0]).toEqual(alert);
    } finally {
      unsubscribe();
    }
  });
  it("supports local-clip review metadata and the existing alert resolution/reset flows", async () => {
    const alert = (
      await api.post("/api/demo/cctv/flag", {
        ...request,
        camera_id: LOCAL_CCTV_SOURCE,
        severity: "HIGH",
      })
    ).data.data;
    expect(alert.title).toBe("CCTV review: Local demo recording");
    await api.post(`/api/alerts/${alert.id}/resolve`, {
      resolution_note: "Reviewed the sample",
    });
    expect((await api.get("/api/alerts/active")).data.data).toHaveLength(5);
    await api.post("/api/demo/reset", {});
    expect(repo.read().alerts.some((alert) => alert.category === "CCTV")).toBe(
      false,
    );
    expect(repo.read().audit).toHaveLength(0);
  });
  it("rejects unavailable and unknown cameras without adding an alert", async () => {
    for (const camera_id of ["CAM-03", "CAM-04", "unknown-camera"]) {
      await expect(
        api.post("/api/demo/cctv/flag", { ...request, camera_id }),
      ).rejects.toThrow();
    }
    expect(repo.read().alerts).toHaveLength(5);
  });
  it("rejects invalid priorities, playback times, and review notes", async () => {
    for (const fields of [
      { playback_seconds: -1 },
      { playback_seconds: "10" },
      { playback_seconds: Infinity },
      { playback_seconds: 604801 },
      { severity: "CRITICAL" },
      { note: "  " },
      { note: "ab" },
      { note: "x".repeat(501) },
    ]) {
      await expect(
        api.post("/api/demo/cctv/flag", { ...request, ...fields }),
      ).rejects.toThrow();
    }
    expect(repo.read().alerts).toHaveLength(5);
  });
});
