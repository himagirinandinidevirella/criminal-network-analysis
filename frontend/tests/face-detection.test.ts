import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  detectionFrameSize,
  normalizeFaceBoxes,
} from "@/utils/faceDetectionUtils";
import {
  CCTVRecordingRegistry,
  planCCTVRecordings,
} from "@/utils/cctvRecordings";

describe("face box geometry (no identity data)", () => {
  it("normalizes boxes, clips frame edges and emits only geometric data and confidence", () => {
    const [box] = normalizeFaceBoxes(
      [{ box: { x: 100, y: 50, width: 200, height: 100 }, score: 0.94 }],
      1000,
      500,
    );
    expect(box).toEqual({
      x: 0.1,
      y: 0.1,
      width: expect.closeTo(0.2),
      height: expect.closeTo(0.2),
      confidence: 0.94,
    });
    expect(Object.keys(box).sort()).toEqual([
      "confidence",
      "height",
      "width",
      "x",
      "y",
    ]);
    expect(
      normalizeFaceBoxes(
        [{ box: { x: -10, y: -10, width: 40, height: 40 }, score: 2 }],
        20,
        20,
      )[0],
    ).toEqual({ x: 0, y: 0, width: 1, height: 1, confidence: 1 });
  });
  it("rejects invalid dimensions and malformed/out-of-frame detections", () => {
    expect(normalizeFaceBoxes([], 0, 100)).toEqual([]);
    expect(
      normalizeFaceBoxes(
        [{ box: { x: 500, y: 100, width: 40, height: 40 }, score: 0.5 }],
        100,
        100,
      ),
    ).toEqual([]);
    expect(
      normalizeFaceBoxes(
        [{ box: { x: NaN, y: 10, width: 40, height: 40 }, score: 0.5 }],
        100,
        100,
      ),
    ).toEqual([]);
    expect(() => detectionFrameSize(0, 1080)).toThrow();
  });
  it("bounds inference size without stretching square or portrait videos", () => {
    expect(detectionFrameSize(1920, 1080)).toEqual({ width: 416, height: 234 });
    expect(detectionFrameSize(1080, 1920)).toEqual({ width: 234, height: 416 });
    expect(detectionFrameSize(320, 180)).toEqual({ width: 320, height: 180 });
  });
  it("ships only detection weights, with verifiable checksums and the upstream licence", () => {
    const directory = "public/models/face-detector/";
    const provenance = JSON.parse(
      readFileSync(directory + "provenance.json", "utf8"),
    );
    for (const [file, expected] of Object.entries(provenance.sha256))
      expect(
        createHash("sha256")
          .update(readFileSync(directory + file))
          .digest("hex"),
      ).toBe(expected);
    expect(
      readdirSync(directory).filter((file) => file.endsWith(".bin")),
    ).toEqual(["tiny_face_detector_model.bin"]);
    expect(readFileSync(directory + "LICENSE.txt", "utf8")).toContain(
      "MIT License",
    );
    expect(
      readdirSync(directory).some((file) =>
        /recognition|gender|expression|landmark/.test(file),
      ),
    ).toBe(false);
  });
});

describe("multi-camera recording lifecycle", () => {
  const slots = ["CAM-01", "CAM-02", "CAM-03", "CAM-04"];
  const clip = (name: string) =>
    new File(["test metadata, not decoded here"], name, { type: "video/webm" });
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  it("assigns multiple files in order, starting at the selected slot", () => {
    const plan = planCCTVRecordings(
      [clip("left.webm"), clip("right.webm"), clip("rear.webm")],
      slots,
      "CAM-03",
    );
    expect(plan.map((entry) => entry.slotId)).toEqual([
      "CAM-03",
      "CAM-04",
      "CAM-01",
    ]);
  });
  it("rejects over-capacity and invalid batch selections before touching existing clips", () => {
    expect(() =>
      planCCTVRecordings(
        Array.from({ length: 5 }, (_, i) => clip(`${i}.webm`)),
        slots,
        slots[0],
      ),
    ).toThrow("up to 4");
    expect(() =>
      planCCTVRecordings(
        [clip("ok.webm"), new File(["bad"], "notes.txt")],
        slots,
        slots[0],
      ),
    ).toThrow("Unsupported");
  });
  it("revokes replaced/closed URLs, releases all clips on unmount and never revokes the public sample", () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL");
    const registry = new CCTVRecordingRegistry();
    const first = registry.install(
      planCCTVRecordings([clip("a.webm"), clip("b.webm")], slots, slots[0]),
    );
    registry.install(planCCTVRecordings([clip("new.webm")], slots, slots[0]));
    expect(revoke).toHaveBeenCalledWith(first["CAM-01"].url);
    const second = registry.records["CAM-01"].url;
    registry.sample("CAM-01");
    expect(revoke).toHaveBeenCalledWith(second);
    registry.dispose();
    expect(revoke).toHaveBeenCalledWith(first["CAM-02"].url);
    expect(revoke).not.toHaveBeenCalledWith("/demo/cctv-face-sample.webm");
    expect(registry.records).toEqual({});
  });
  it("cleans up partial URL allocation failures and preserves previous assignments", () => {
    const registry = new CCTVRecordingRegistry();
    const existing = registry.install(
      planCCTVRecordings([clip("a.webm")], slots, slots[0]),
    );
    const create = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValueOnce("blob:temporary")
      .mockImplementationOnce(() => {
        throw new Error("allocation failed");
      });
    const revoke = vi.spyOn(URL, "revokeObjectURL");
    expect(() =>
      registry.install(
        planCCTVRecordings([clip("b.webm"), clip("c.webm")], slots, slots[0]),
      ),
    ).toThrow("allocation failed");
    expect(revoke).toHaveBeenCalledWith("blob:temporary");
    expect(registry.records).toEqual(existing);
    create.mockRestore();
    registry.dispose();
  });
});
