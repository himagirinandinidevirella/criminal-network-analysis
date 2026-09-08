import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

const errors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const list: string[] = [];
  errors.set(page, list);
  page.on("pageerror", (error) => list.push(error.message));
  await page.goto("/login");
  await page.getByRole("button", { name: "Explore demo", exact: true }).click();
  await page.getByRole("button", { name: "CCTV monitor", exact: true }).click();
  await expect(
    page.getByRole("group", { name: "CCTV view CAM-01", exact: true }),
  ).toBeVisible();
});
test.afterEach(async ({ page }) => {
  expect(errors.get(page)).toEqual([]);
});
const wall = (page: Page) =>
  page.getByRole("region", { name: "CCTV Monitor", exact: true });
const camera = (page: Page, id: string) =>
  page.getByRole("group", { name: `CCTV view ${id}`, exact: true });
const fixture = async (name: string) => ({
  name,
  mimeType: "video/webm",
  buffer: await readFile("public/demo/cctv-face-sample.webm"),
});

test("all-camera wall is the default, with a real composite PNG export", async ({
  page,
}) => {
  const panel = wall(page);
  await expect(
    panel.getByRole("button", { name: "All cameras", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  for (const id of ["CAM-01", "CAM-02", "CAM-03", "CAM-04"])
    await expect(camera(page, id)).toBeVisible();
  const pending = page.waitForEvent("download");
  await panel
    .getByRole("button", { name: "Download combined snapshot", exact: true })
    .click();
  const download = await pending,
    png = await readFile((await download.path())!);
  expect(download.suggestedFilename()).toBe("cctv-all-cameras.png");
  expect(png.readUInt32BE(16)).toBe(1280);
  expect(png.readUInt32BE(20)).toBe(768);
  await panel
    .getByRole("button", { name: "Focus CAM-02", exact: true })
    .click();
  await expect(
    panel.getByRole("button", { name: "Single camera", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(camera(page, "CAM-02")).toBeVisible();
  await expect(camera(page, "CAM-01")).toHaveCount(0);
  await panel.getByRole("button", { name: "All cameras", exact: true }).click();
  await expect(camera(page, "CAM-01")).toBeVisible();
});

test("actual local model detects the synthetic test face, with no identity model or upload", async ({
  page,
}) => {
  const requests: string[] = [],
    uploads: string[] = [];
  page.on("request", (request) => {
    requests.push(request.url());
    if (request.method() === "POST") uploads.push(request.url());
  });
  const panel = wall(page);
  await expect(
    panel.getByLabel("Enable AI face detection", { exact: true }),
  ).not.toBeChecked();
  expect(requests.filter((url) => url.includes("/models/"))).toEqual([]);
  await panel
    .getByRole("button", { name: "Try AI test clip", exact: true })
    .click();
  await expect(camera(page, "CAM-01").locator("[data-face-box]")).toHaveCount(
    1,
    { timeout: 45000 },
  );
  await expect(
    camera(page, "CAM-01").getByTestId("face-detection-status"),
  ).toHaveText("1 face detected");
  await expect(panel.getByTestId("face-total")).toContainText(
    "1 face detection across 1 analysed view",
  );
  expect(
    requests.some((url) => url.includes("tiny_face_detector_model.bin")),
  ).toBe(true);
  expect(
    requests.some((url) =>
      /face_recognition|age_gender|face_expression|landmark/.test(url),
    ),
  ).toBe(false);
  expect(
    requests.filter(
      (url) =>
        !url.startsWith("http://127.0.0.1:3000") &&
        !url.startsWith("blob:") &&
        !url.startsWith("data:"),
    ),
  ).toEqual([]);
  expect(uploads).toEqual([]);
  await panel.getByLabel("Enable AI face detection", { exact: true }).uncheck();
  await expect(panel.locator("[data-face-box]")).toHaveCount(0);
  await expect(
    camera(page, "CAM-01").getByTestId("face-detection-status"),
  ).toHaveText("Face detection off");
  const data = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("crimenet:demo-workspace:v1")!),
  );
  expect(data).not.toHaveProperty("face_detections");
  expect(data).not.toHaveProperty("embeddings");
  expect(data.people).toHaveLength(40);
  expect(data.evidence).toHaveLength(0);
  await panel
    .getByRole("button", { name: "Close all recordings", exact: true })
    .click();
  await expect(panel.locator("video")).toHaveCount(0);
});

test("multiple recordings keep independent media and counts across wall/focus switches", async ({
  page,
}) => {
  const panel = wall(page);
  await panel
    .getByLabel("CCTV recording file")
    .setInputFiles([
      await fixture("front-test.webm"),
      await fixture("other-view-test.webm"),
    ]);
  await expect(camera(page, "CAM-01").locator("video")).toBeVisible();
  await expect(camera(page, "CAM-02").locator("video")).toBeVisible();
  const firstUrl = (await camera(page, "CAM-01")
    .locator("video")
    .getAttribute("src"))!;
  const secondUrl = (await camera(page, "CAM-02")
    .locator("video")
    .getAttribute("src"))!;
  expect(firstUrl).not.toBe(secondUrl);
  await panel.getByLabel("Enable AI face detection", { exact: true }).check();
  await expect(panel.getByTestId("face-total")).toContainText(
    "2 face detections across 2 analysed views",
    { timeout: 45000 },
  );
  await panel
    .getByRole("button", { name: "Play all recordings", exact: true })
    .click();
  const secondVideo = camera(page, "CAM-02").locator("video");
  await expect
    .poll(() =>
      secondVideo.evaluate((video: HTMLVideoElement) => video.currentTime),
    )
    .toBeGreaterThan(0);
  await panel
    .getByRole("button", { name: "Pause all recordings", exact: true })
    .click();
  const time = await secondVideo.evaluate(
    (video: HTMLVideoElement) => video.currentTime,
  );
  await panel
    .getByRole("button", { name: "Focus CAM-02", exact: true })
    .click();
  expect(await secondVideo.getAttribute("src")).toBe(secondUrl);
  expect(
    await secondVideo.evaluate((video: HTMLVideoElement) => video.currentTime),
  ).toBeCloseTo(time, 1);
  await panel
    .getByRole("button", { name: "Close recording", exact: true })
    .click();
  await expect(secondVideo).toHaveCount(0);
  await expect(camera(page, "CAM-02").locator("[data-face-box]")).toHaveCount(
    0,
  );
  await panel.getByRole("button", { name: "All cameras", exact: true }).click();
  expect(
    await camera(page, "CAM-01").locator("video").getAttribute("src"),
  ).toBe(firstUrl);
  await panel
    .getByRole("button", { name: "Close all recordings", exact: true })
    .click();
  await expect(panel.locator("video")).toHaveCount(0);
  await expect(panel.locator("[data-face-box]")).toHaveCount(0);
});

test("model-load failure is recoverable and does not prevent video playback", async ({
  page,
}) => {
  await page.route("**/models/face-detector/**", (route) => route.abort());
  const panel = wall(page);
  await panel
    .getByRole("button", { name: "Try AI test clip", exact: true })
    .click();
  await expect(
    panel.getByRole("button", { name: "Retry face detector", exact: true }),
  ).toBeVisible();
  await expect(camera(page, "CAM-01").locator("video")).toBeVisible();
  await expect(
    panel.getByRole("button", {
      name: "Download combined snapshot",
      exact: true,
    }),
  ).toBeEnabled();
  await page.unroute("**/models/face-detector/**");
  await panel
    .getByRole("button", { name: "Retry face detector", exact: true })
    .click();
  await expect(camera(page, "CAM-01").locator("[data-face-box]")).toHaveCount(
    1,
    { timeout: 45000 },
  );
});

test("four videos can be opened together; invalid batches leave existing recordings intact", async ({
  page,
}) => {
  const panel = wall(page);
  const inputs = await Promise.all(
    [1, 2, 3, 4].map((index) => fixture(`view-${index}.webm`)),
  );
  await panel.getByLabel("CCTV recording file").setInputFiles(inputs);
  for (const id of ["CAM-01", "CAM-02", "CAM-03", "CAM-04"])
    await expect(camera(page, id).locator("video")).toBeVisible();
  const before = await panel
    .locator("video")
    .evaluateAll((videos) =>
      videos.map((video) => (video as HTMLVideoElement).src),
    );
  await panel
    .getByLabel("CCTV recording file")
    .setInputFiles([...inputs, await fixture("extra.webm")]);
  await expect(panel.getByRole("alert")).toContainText("up to 4 recordings");
  expect(
    await panel
      .locator("video")
      .evaluateAll((videos) =>
        videos.map((video) => (video as HTMLVideoElement).src),
      ),
  ).toEqual(before);
  await panel
    .getByLabel("CCTV recording file")
    .setInputFiles([
      await fixture("valid.webm"),
      {
        name: "invalid.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("not a video"),
      },
    ]);
  await expect(panel.getByRole("alert")).toContainText("Unsupported recording");
  expect(
    await panel
      .locator("video")
      .evaluateAll((videos) =>
        videos.map((video) => (video as HTMLVideoElement).src),
      ),
  ).toEqual(before);
  await page.setViewportSize({ width: 390, height: 844 });
  const size = await panel.evaluate((element) => ({
    scroll: element.scrollWidth,
    width: element.clientWidth,
  }));
  expect(size.scroll).toBeLessThanOrEqual(size.width);
});
