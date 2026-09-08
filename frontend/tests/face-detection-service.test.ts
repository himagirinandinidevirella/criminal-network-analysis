import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocked = vi.hoisted(() => ({
  load: vi.fn(),
  detect: vi.fn(),
  setBackend: vi.fn(),
  drawImage: vi.fn(),
}));
vi.mock("@vladmandic/face-api", () => ({
  tf: {
    setBackend: mocked.setBackend,
    ready: async () => {},
    getBackend: () => "cpu",
  },
  nets: {
    tinyFaceDetector: {
      loadFromUri: mocked.load,
      isLoaded: false,
      dispose: vi.fn(),
    },
  },
  detectAllFaces: mocked.detect,
  TinyFaceDetectorOptions: class {
    constructor(public options: unknown) {}
  },
}));
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocked.load.mockResolvedValue(undefined);
  mocked.detect.mockResolvedValue([]);
  mocked.setBackend.mockResolvedValue(true);
  vi.stubGlobal("document", {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({ drawImage: mocked.drawImage }),
    }),
  });
});
afterEach(() => {
  vi.stubGlobal("document", undefined);
});
const video = () =>
  ({
    readyState: 2,
    seeking: false,
    videoWidth: 640,
    videoHeight: 360,
    currentTime: 8,
  }) as HTMLVideoElement;

it("coalesces model loading and uses only same-origin detection assets", async () => {
  const service = await import("@/services/faceDetectionService");
  await Promise.all([service.loadFaceDetector(), service.loadFaceDetector()]);
  expect(mocked.load).toHaveBeenCalledTimes(1);
  expect(mocked.load).toHaveBeenCalledWith("/models/face-detector");
});
it("recovers from model-load failure and falls back to CPU when WebGL is unavailable", async () => {
  mocked.setBackend.mockResolvedValueOnce(false);
  mocked.load.mockRejectedValueOnce(new Error("missing weights"));
  const service = await import("@/services/faceDetectionService");
  await expect(service.loadFaceDetector()).rejects.toThrow("missing weights");
  expect(mocked.setBackend).toHaveBeenCalledWith("cpu");
  await expect(service.loadFaceDetector()).resolves.toEqual({ backend: "cpu" });
  expect(mocked.load).toHaveBeenCalledTimes(2);
});
it("never runs queued inference on a cancelled source", async () => {
  const service = await import("@/services/faceDetectionService");
  let finish!: (value: []) => void;
  mocked.detect.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const first = service.detectVideoFaces(
    video(),
    0.6,
    new AbortController().signal,
  );
  const controller = new AbortController();
  const second = service.detectVideoFaces(video(), 0.6, controller.signal);
  const cancelled = expect(second).rejects.toMatchObject({
    name: "AbortError",
  });
  await vi.waitFor(() => expect(mocked.detect).toHaveBeenCalledTimes(1));
  controller.abort();
  finish([]);
  await first;
  await cancelled;
  expect(mocked.detect).toHaveBeenCalledTimes(1);
});
it("captures time/geometry and discards an in-flight result after cancellation", async () => {
  const service = await import("@/services/faceDetectionService");
  const frame = await service.detectVideoFaces(
    video(),
    0.6,
    new AbortController().signal,
  );
  expect(frame).toMatchObject({
    sourceTime: 8,
    width: 640,
    height: 360,
    boxes: [],
  });
  const controller = new AbortController();
  mocked.detect.mockImplementationOnce(async () => {
    controller.abort();
    return [];
  });
  await expect(
    service.detectVideoFaces(video(), 0.6, controller.signal),
  ).rejects.toMatchObject({ name: "AbortError" });
});
