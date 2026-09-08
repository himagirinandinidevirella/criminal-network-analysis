import { test, expect, type Page, type Download } from "@playwright/test";
import { readFile } from "node:fs/promises";

const errors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const collected: string[] = [];
  errors.set(page, collected);
  page.on("pageerror", (error) => collected.push(error.message));
  await page.goto("/login");
  await page.getByRole("button", { name: "Explore demo", exact: true }).click();
  await page.getByRole("button", { name: "CCTV monitor", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "CCTV Monitor", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Single camera", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Download snapshot", exact: true }),
  ).toBeEnabled();
});
test.afterEach(async ({ page }) => {
  expect(errors.get(page)).toEqual([]);
});
const content = async (download: Download) =>
  readFile((await download.path())!);

test("camera selection, filtering, pause/resume and offline states", async ({
  page,
}) => {
  const panel = page.getByRole("region", { name: "CCTV Monitor", exact: true });
  await expect(
    panel.getByText("2 simulated feeds available · 4 demo cameras", {
      exact: true,
    }),
  ).toBeVisible();
  const canvas = panel.locator("canvas:visible");
  await expect(canvas).toHaveAttribute("aria-label", /Junction overview/);
  await panel
    .getByRole("button", { name: "Pause simulation", exact: true })
    .click();
  await expect(
    panel
      .getByText("Simulation paused", { exact: true })
      .filter({ visible: true }),
  ).toBeVisible();
  const time = await canvas.getAttribute("data-elapsed");
  await page.waitForTimeout(250);
  expect(await canvas.getAttribute("data-elapsed")).toBe(time);
  await panel
    .getByRole("button", { name: "Resume simulation", exact: true })
    .click();
  await expect
    .poll(async () => Number(await canvas.getAttribute("data-elapsed")))
    .toBeGreaterThan(Number(time));
  await panel
    .getByRole("button", { name: /CAM-02.*Warehouse perimeter/ })
    .click();
  await expect(canvas).toHaveAttribute("aria-label", /Warehouse perimeter/);
  await panel.getByLabel("Find CCTV camera").fill("missing camera");
  await expect(
    panel.getByText("No cameras match these filters.", { exact: true }),
  ).toBeVisible();
  await panel
    .getByRole("button", { name: "Reset camera filters", exact: true })
    .click();
  await panel.getByLabel("CCTV camera status").selectOption("OFFLINE");
  await panel.getByRole("button", { name: /CAM-03.*Transit entry/ }).click();
  await expect(
    panel.getByText("Camera offline", { exact: true }),
  ).toBeVisible();
  await expect(
    panel.getByRole("button", { name: "Download snapshot", exact: true }),
  ).toBeDisabled();
  await expect(
    panel.getByRole("button", { name: "Flag for review", exact: true }),
  ).toBeDisabled();
  await panel.getByLabel("CCTV camera status").selectOption("MAINTENANCE");
  await panel.getByRole("button", { name: /CAM-04.*Service gate/ }).click();
  await expect(
    panel.getByText("Camera under maintenance", { exact: true }),
  ).toBeVisible();
});

test("actual PNG snapshot and persisted manual flag appear in Alerts", async ({
  page,
}) => {
  const panel = page.getByRole("region", { name: "CCTV Monitor", exact: true });
  const pending = page.waitForEvent("download");
  await panel
    .getByRole("button", { name: "Download snapshot", exact: true })
    .click();
  const download = await pending,
    png = await content(download);
  expect(download.suggestedFilename()).toMatch(/^cctv-CAM-01-.*\.png$/);
  expect(png.subarray(1, 4).toString()).toBe("PNG");
  expect(png.readUInt32BE(16)).toBe(960);
  expect(png.readUInt32BE(20)).toBe(598);
  await panel
    .getByRole("button", { name: "Flag for review", exact: true })
    .click();
  await expect(
    panel
      .getByText("Simulation paused", { exact: true })
      .filter({ visible: true }),
  ).toBeVisible();
  await panel
    .getByLabel("Review note", { exact: true })
    .fill("Review the fictional crossing at the demo junction.");
  await panel
    .getByLabel("Review priority", { exact: true })
    .selectOption("HIGH");
  await panel
    .getByRole("button", { name: "Save review flag", exact: true })
    .click();
  await expect(
    page.getByText("CCTV review flag saved to Alerts", { exact: true }),
  ).toBeVisible();
  await panel
    .getByRole("link", { name: "Review flagged moments", exact: true })
    .click();
  const alert = page.getByRole("article", {
    name: "CCTV review: Junction overview",
    exact: true,
  });
  await expect(alert).toContainText("Review the fictional crossing");
  await expect(alert).toContainText("HIGH");
  await expect(alert).toContainText("No automated identity matching");
  await page.reload();
  await expect(alert).toBeVisible();
  await alert.getByRole("button", { name: "Resolve", exact: true }).click();
  await expect(alert).toHaveCount(0);
});

test("rejects invalid files and handles an undecodable video without enabling frame actions", async ({
  page,
}) => {
  const panel = page.getByRole("region", { name: "CCTV Monitor", exact: true });
  await panel.getByLabel("CCTV recording file").setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not a video"),
  });
  await expect(panel.getByRole("alert")).toContainText("Unsupported recording");
  await expect(panel.locator("canvas:visible")).toBeVisible();
  await panel.getByLabel("CCTV recording file").setInputFiles({
    name: "broken.mp4",
    mimeType: "video/mp4",
    buffer: Buffer.from("not a valid MP4"),
  });
  await expect(panel.getByRole("alert")).toContainText("could not be played");
  await expect(
    panel.getByRole("button", { name: "Download snapshot", exact: true }),
  ).toBeDisabled();
  await expect(
    panel.getByRole("button", { name: "Flag for review", exact: true }),
  ).toBeDisabled();
  await panel
    .getByRole("button", { name: "Close recording", exact: true })
    .click();
  await expect(panel.locator("canvas:visible")).toBeVisible();
  await expect(
    panel.getByRole("button", { name: "Download snapshot", exact: true }),
  ).toBeEnabled();
});

test("plays an actual local WebM and captures its frame without uploading it", async ({
  page,
}) => {
  const videoBytes = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 180;
    const ctx = canvas.getContext("2d")!;
    const stream = canvas.captureStream(12);
    const recorder = new MediaRecorder(stream, {
      mimeType: "video/webm;codecs=vp8",
    });
    const blobs: Blob[] = [];
    const done = new Promise<Blob>((resolve) => {
      recorder.ondataavailable = (event) => blobs.push(event.data);
      recorder.onstop = () => resolve(new Blob(blobs, { type: "video/webm" }));
    });
    recorder.start();
    let frame = 0;
    const draw = setInterval(() => {
      ctx.fillStyle = "#334b51";
      ctx.fillRect(0, 0, 320, 180);
      ctx.fillStyle = "#fff";
      ctx.fillRect((frame++ * 12) % 300, 80, 20, 20);
    }, 80);
    await new Promise((resolve) => setTimeout(resolve, 700));
    recorder.stop();
    clearInterval(draw);
    const blob = await done;
    stream.getTracks().forEach((track) => track.stop());
    return [...new Uint8Array(await blob.arrayBuffer())];
  });
  const uploads: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST") uploads.push(request.url());
  });
  const panel = page.getByRole("region", { name: "CCTV Monitor", exact: true });
  await panel.getByLabel("CCTV recording file").setInputFiles({
    name: "synthetic-test.webm",
    mimeType: "video/webm",
    buffer: Buffer.from(videoBytes),
  });
  const video = panel.getByLabel("Local CCTV recording", { exact: true });
  await expect(video).toBeVisible();
  await expect(
    panel.getByRole("button", { name: "Download snapshot", exact: true }),
  ).toBeEnabled();
  const source = (await video.getAttribute("src"))!;
  expect(source).toMatch(/^blob:/);
  await video.evaluate(async (element: HTMLVideoElement) => {
    await element.play();
  });
  await expect
    .poll(() =>
      video.evaluate((element: HTMLVideoElement) => element.currentTime),
    )
    .toBeGreaterThan(0);
  const pending = page.waitForEvent("download");
  await panel
    .getByRole("button", { name: "Download snapshot", exact: true })
    .click();
  const png = await content(await pending);
  expect(png.readUInt32BE(16)).toBe(320);
  expect(png.readUInt32BE(20)).toBe(238);
  await panel
    .getByRole("button", { name: "Close recording", exact: true })
    .click();
  await expect(video).toHaveCount(0);
  expect(
    await page.evaluate(async (url) => {
      try {
        await fetch(url);
        return false;
      } catch {
        return true;
      }
    }, source),
  ).toBe(true);
  expect(uploads).toEqual([]);
});

test("CCTV controls remain usable on mobile and respect reduced motion", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await page.getByRole("button", { name: "CCTV monitor", exact: true }).click();
  await page
    .getByRole("button", { name: "Single camera", exact: true })
    .click();
  const panel = page.getByRole("region", { name: "CCTV Monitor", exact: true });
  await expect(
    panel
      .getByText("Simulation paused", { exact: true })
      .filter({ visible: true }),
  ).toBeVisible();
  await panel
    .getByRole("button", { name: /CAM-02.*Warehouse perimeter/ })
    .click();
  await expect(panel.locator("canvas:visible")).toHaveAttribute(
    "aria-label",
    /Warehouse perimeter/,
  );
  const dimensions = await page.evaluate(() => ({
    viewport: innerWidth,
    page: document.documentElement.scrollWidth,
    panel: document.getElementById("cctv-monitor")!.scrollWidth,
    width: document.getElementById("cctv-monitor")!.clientWidth,
  }));
  expect(dimensions.page).toBeLessThanOrEqual(dimensions.viewport);
  expect(dimensions.panel).toBeLessThanOrEqual(dimensions.width);
});
