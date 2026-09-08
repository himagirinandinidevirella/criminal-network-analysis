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
    page.getByRole("button", { name: "Track moment from CAM-01", exact: true }),
  ).toBeEnabled();
});
test.afterEach(async ({ page }) => {
  expect(errors.get(page)).toEqual([]);
});
const tracking = (page: Page) =>
  page.getByRole("region", { name: "Cross-camera tracking", exact: true });
async function saveMoment(
  page: Page,
  title?: string,
  note = "Review this fictional event.",
) {
  const panel = tracking(page);
  if (title)
    await panel.getByLabel("New trail title", { exact: true }).fill(title);
  await panel.getByLabel("Tracking moment note", { exact: true }).fill(note);
  await panel
    .getByRole("checkbox", { name: /I am linking these events manually/ })
    .check();
  await panel
    .getByRole("button", { name: "Save tracking moment", exact: true })
    .click();
  await expect(
    panel.getByLabel("Tracking moment note", { exact: true }),
  ).toHaveCount(0);
}

test("links two camera moments, shows their manual route, reorders, exports and jumps back", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Track moment from CAM-01", exact: true })
    .click();
  await expect(
    tracking(page).getByRole("button", {
      name: "Save tracking moment",
      exact: true,
    }),
  ).toBeDisabled();
  await saveMoment(
    page,
    "Loading-area review",
    "First fictional camera event.",
  );
  await page
    .getByRole("button", { name: "Track moment from CAM-02", exact: true })
    .click();
  await saveMoment(page, undefined, "Second event linked by the reviewer.");
  const panel = tracking(page);
  const sequence = panel.getByLabel("Manual camera sequence", { exact: true });
  await expect(sequence).toHaveText(/CAM-01.*CAM-02/);
  await expect(
    panel
      .getByRole("list", { name: "Tracked camera moments" })
      .getByRole("listitem"),
  ).toHaveCount(2);
  await expect(panel.getByText(/2 cameras · 1 view change/)).toBeVisible();
  await panel
    .getByRole("button", { name: "Move moment 2 up", exact: true })
    .click();
  await expect(sequence).toHaveText(/CAM-02.*CAM-01/);
  const pending = page.waitForEvent("download");
  await panel.getByLabel("Export camera trail", { exact: true }).click();
  const data = JSON.parse(
    await readFile((await (await pending).path())!, "utf8"),
  );
  expect(data.notice).toContain("not face matching");
  expect(
    data.trail.moments.map((m: { camera_id: string }) => m.camera_id),
  ).toEqual(["CAM-02", "CAM-01"]);
  expect(data.trail.moments[0]).not.toHaveProperty("source_instance");
  expect(data.trail.moments[0].association).toBe("MANUAL_UNVERIFIED");
  await panel
    .getByRole("button", { name: "Jump to moment 1", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Single camera", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  const camera = page.getByRole("group", {
    name: "CCTV view CAM-02",
    exact: true,
  });
  await expect(camera).toBeVisible();
  expect(
    Number(await camera.locator("canvas").getAttribute("data-elapsed")),
  ).toBeCloseTo(data.trail.moments[0].playback_seconds, 3);
});

test("saved trails survive reload and support confirmed removal/deletion", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Track moment from CAM-01", exact: true })
    .click();
  await saveMoment(page, "Persisted manual review");
  const id = await tracking(page)
    .getByLabel("Tracking trail", { exact: true })
    .inputValue();
  await page.reload();
  await page
    .getByRole("button", { name: "Cross-camera tracking", exact: true })
    .click();
  const panel = tracking(page);
  await panel.getByLabel("Tracking trail", { exact: true }).selectOption(id);
  await expect(
    panel.getByText("Review this fictional event.", { exact: true }),
  ).toBeVisible();
  await panel
    .getByRole("button", { name: "Remove moment 1", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Remove moment", exact: true })
    .click();
  await expect(
    panel
      .getByRole("list", { name: "Tracked camera moments" })
      .getByRole("listitem"),
  ).toHaveCount(0);
  await panel.getByLabel("Delete camera trail", { exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete trail", exact: true })
    .click();
  await expect(panel.getByLabel("Tracking trail", { exact: true })).toHaveValue(
    "new",
  );
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("crimenet:demo-workspace:v1")!)
          .cctv_trails,
    ),
  ).toEqual([]);
});

test("a closed or same-named replaced video cannot be used to replay an old bookmark", async ({
  page,
}) => {
  const file = {
    name: "local-test.webm",
    mimeType: "video/webm",
    buffer: await readFile("public/demo/cctv-face-sample.webm"),
  };
  await page.getByLabel("CCTV recording file").setInputFiles(file);
  await page
    .getByRole("button", { name: "Single camera", exact: true })
    .click();
  const video = page.getByLabel("Local CCTV recording", { exact: true });
  await expect(
    page.getByRole("button", { name: "Add moment to trail", exact: true }),
  ).toBeEnabled();
  await video.evaluate((element: HTMLVideoElement) => {
    element.currentTime = 0.5;
  });
  await expect
    .poll(() =>
      video.evaluate(
        (element: HTMLVideoElement) =>
          !element.seeking && element.readyState >= 2,
      ),
    )
    .toBe(true);
  await page
    .getByRole("button", { name: "Add moment to trail", exact: true })
    .click();
  await saveMoment(page, "Local recording review");
  const panel = tracking(page);
  await expect(
    panel.getByRole("button", { name: "Jump to moment 1", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Close recording", exact: true })
    .click();
  await expect(
    panel.getByRole("button", { name: "Jump to moment 1", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("CCTV recording file").setInputFiles(file);
  await expect(
    page.getByRole("button", { name: "Add moment to trail", exact: true }),
  ).toBeEnabled();
  await expect(
    panel.getByRole("button", { name: "Jump to moment 1", exact: true }),
  ).toBeDisabled();
  const saved = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("crimenet:demo-workspace:v1")!)
        .cctv_trails,
  );
  expect(JSON.stringify(saved)).not.toContain("blob:");
  expect(JSON.stringify(saved)).not.toContain("local-test.webm");
});

test("offline cameras cannot capture moments and the tracking panel fits a mobile viewport", async ({
  page,
}) => {
  await expect(
    page.getByRole("button", { name: "Track moment from CAM-03", exact: true }),
  ).toBeDisabled();
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Cross-camera tracking", exact: true })
    .click();
  const panel = tracking(page);
  await expect(
    panel.getByRole("heading", { name: "Cross-camera tracking", exact: true }),
  ).toBeVisible();
  const bounds = await panel.evaluate((element) => ({
    scroll: element.scrollWidth,
    width: element.clientWidth,
  }));
  expect(bounds.scroll).toBeLessThanOrEqual(bounds.width);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
