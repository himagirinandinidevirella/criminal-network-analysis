import { test, expect, type Page, type Download } from "@playwright/test";
import { readFile } from "node:fs/promises";

const failures = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  failures.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.message));
});
test.afterEach(async ({ page }) => {
  expect(failures.get(page), "No uncaught browser errors").toEqual([]);
});
async function enterDemo(page: Page) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Explore demo", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "See the network behind the crime." }),
  ).toBeVisible();
}
async function bytes(download: Download) {
  return readFile((await download.path())!);
}
async function generate(page: Page) {
  const pending = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Generate report", exact: true })
    .click();
  return pending;
}

test("login validation, isolated session, populated dashboard and logout", async ({
  page,
}) => {
  const backendRequests: string[] = [];
  page.on("request", (r) => {
    if (new URL(r.url()).pathname.startsWith("/api/"))
      backendRequests.push(r.url());
  });
  await page.goto("/network");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Badge / Employee ID").fill("admin@crimenet.gov.in");
  await page.getByLabel("Password", { exact: true }).fill("incorrect");
  await page.locator('form button[type="submit"]').click();
  await expect(page.getByText(/Badge or password is incorrect/)).toBeVisible();
  await page.getByRole("button", { name: "Explore demo", exact: true }).click();
  await expect(
    page.locator("main").getByText("40", { exact: true }),
  ).toBeVisible();
  await expect(
    page.locator("main").getByText("112", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("crimenet_access_token")),
  ).toBeNull();
  await page.reload();
  await expect(
    page.locator("main").getByText("40", { exact: true }),
  ).toBeVisible();
  expect(backendRequests).toEqual([]);
  await page.getByRole("button", { name: "Logout", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("search, real advanced filters, global query updates and FIR preview", async ({
  page,
}) => {
  await enterDemo(page);
  await page.goto("/investigation?q=Raja");
  await expect(
    page.getByText("1 matching entity", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Advanced Filters", exact: true })
    .click();
  await page.getByLabel("Risk level", { exact: true }).selectOption("LOW");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page.getByText(/No matching entities/)).toBeVisible();
  await page
    .getByRole("button", { name: "Reset filters", exact: true })
    .click();
  await expect(
    page.getByText("1 matching entity", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Global search").fill("Vikram Rao");
  await page.getByLabel("Global search").press("Enter");
  await expect(
    page.getByPlaceholder(
      "Search by name, alias, vehicle registration, account, location…",
    ),
  ).toHaveValue("Vikram Rao");
  await page.getByRole("button", { name: /Vikram Rao.*Person/ }).click();
  await expect(
    page.getByRole("heading", { name: "Vikram Rao", exact: true }),
  ).toBeVisible();
  await page.goto("/investigation?mode=fir");
  await page.getByRole("button", { name: "ANALYZE FIR", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Extracted Entities", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/No new graph records were created/),
  ).toBeVisible();
  await page
    .getByLabel("FIR document")
    .fill("There are no known names in this synthetic example.");
  await page.getByRole("button", { name: "ANALYZE FIR", exact: true }).click();
  await expect(page.getByText(/No known fixture names/)).toBeVisible();
});

test("graph inspection, paths, filters, layouts, screenshot and non-destructive what-if", async ({
  page,
}) => {
  await enterDemo(page);
  await page.goto("/network");
  await page.getByLabel("Inspect entity").selectOption("raja-khan");
  await expect(
    page.getByRole("heading", { name: "Raja Khan", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("From criminal", { exact: true })
    .selectOption("raja-khan");
  await page
    .getByLabel("To criminal", { exact: true })
    .selectOption("vikram-rao");
  await page
    .getByRole("button", { name: "FIND CONNECTION", exact: true })
    .click();
  await expect(
    page.getByText(/Path: Raja Khan → Meena Patil → Vikram Rao \(2 hops\)/),
  ).toBeVisible();
  await page.getByLabel("Filter by risk level").selectOption("LOW");
  await expect(
    page.getByLabel("Inspect entity").locator('option[value="raja-khan"]'),
  ).toHaveCount(0);
  await page.getByLabel("Reset view").click();
  await expect(page.getByLabel("Filter by risk level")).toHaveValue("");
  await page.getByLabel("Graph layout").selectOption("dagre");
  await page.getByLabel("Inspect entity").selectOption("vehicle-1");
  await expect(
    page.getByRole("heading", { name: "MH-01-AX-9999", exact: true }),
  ).toBeVisible();
  const screenshot = page.waitForEvent("download");
  await page.getByLabel("Screenshot", { exact: true }).click();
  expect((await bytes(await screenshot)).subarray(1, 4).toString()).toBe("PNG");
  await page.getByRole("tab", { name: "What-If", exact: true }).click();
  await page
    .getByLabel("Select criminal to simulate arrest")
    .selectOption("raja-khan");
  await page.getByRole("button", { name: "SIMULATE", exact: true }).click();
  await expect(
    page.getByText("Nodes removed", { exact: true }).locator(".."),
  ).toContainText("1");
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("crimenet:demo-workspace:v1")!).people
          .length,
    ),
  ).toBe(40);
  await page.getByRole("tab", { name: "Gangs", exact: true }).click();
  await expect(
    page.getByText("Seeded Networks", { exact: true }),
  ).toBeVisible();
});

test("profile review, notes, file checksum and local preview survive reload", async ({
  page,
}) => {
  await enterDemo(page);
  await page.goto("/criminal/shyam-verma");
  await page.getByRole("button", { name: "Verify", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Verified", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Notes", exact: true }).click();
  await page
    .getByLabel("Investigator note", { exact: true })
    .fill("Synthetic follow-up: review the transfer reference.");
  await page.getByRole("button", { name: "Save Note", exact: true }).click();
  await expect(
    page.getByText("Synthetic follow-up: review the transfer reference.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Flag", exact: true }).click();
  await page
    .getByRole("button", { name: "Flag as priority", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Flagged", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "File checksum", exact: true })
    .click();
  await page
    .getByLabel("Evidence file", { exact: true })
    .setInputFiles({
      name: "synthetic.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("synthetic evidence only"),
    });
  await page
    .getByRole("button", { name: "Record checksum", exact: true })
    .click();
  await expect(page.getByText(/SHA-256: [a-f0-9]{64}/)).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Verified", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText("Synthetic follow-up: review the transfer reference.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Share", exact: true }).click();
  await page
    .getByRole("button", { name: "Create local preview link", exact: true })
    .click();
  const link = page.locator('a[href*="/public/report/"]').last();
  await expect(link).toBeVisible();
  const href = (await link.getAttribute("href"))!;
  await page.evaluate(() => {
    localStorage.removeItem("crimenet_demo_access_token");
    localStorage.removeItem("crimenet_demo_refresh_token");
    localStorage.removeItem("crimenet_demo_user");
  });
  await page.goto(href);
  await expect(
    page.getByRole("heading", { name: "Shared Report", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/This is a local snapshot/)).toBeVisible();
  await expect(page.locator("pre")).toContainText("Synthetic follow-up");
});

test("local alert delivery and functional assign/escalate/resolve/rule actions", async ({
  page,
}) => {
  await enterDemo(page);
  await page.goto("/alerts");
  await expect(page.getByRole("article")).toHaveCount(5);
  await page
    .getByRole("button", { name: "Trigger demo alert", exact: true })
    .click();
  await expect(page.getByRole("article")).toHaveCount(6);
  const alert = page.getByRole("article", {
    name: "Simulated financial alert",
    exact: true,
  });
  await alert.getByRole("button", { name: "View", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("dialog").getByLabel("Close", { exact: true }).click();
  await alert
    .getByRole("button", { name: "Assign to me", exact: true })
    .click();
  await expect(alert).toContainText("Assigned to: admin@crimenet.gov.in");
  await alert.getByRole("button", { name: "Escalate", exact: true }).click();
  await expect(
    alert.getByRole("button", { name: "Escalate", exact: true }),
  ).toBeDisabled();
  await alert.getByRole("button", { name: "Resolve", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(5);
  await page.getByRole("button", { name: "Create Rule", exact: true }).click();
  await page.getByLabel("Rule threshold").fill("0");
  await page.getByRole("button", { name: "Add Rule", exact: true }).click();
  await expect(
    page.getByText("Enter a positive threshold", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Rule threshold").fill("1234");
  await page.getByRole("button", { name: "Add Rule", exact: true }).click();
  await expect(page.getByText("Configured", { exact: true })).toHaveCount(2);
  await page.reload();
  await expect(page.getByRole("article")).toHaveCount(5);
});

test("downloads valid JSON, CSV, XLSX, PDF and re-downloads report history", async ({
  page,
}) => {
  await enterDemo(page);
  await page.goto("/reports?criminal=raja-khan");
  const sections = page.getByRole("group", { name: "Include sections" });
  await expect(sections.getByRole("checkbox")).toHaveCount(7);
  for (const box of await sections.getByRole("checkbox").all())
    await box.uncheck();
  await expect(
    page.getByRole("button", { name: "Generate report", exact: true }),
  ).toBeDisabled();
  await sections.getByLabel("Personal Profile", { exact: true }).check();
  for (const format of ["JSON", "CSV", "XLSX", "PDF"]) {
    await page.getByLabel(format, { exact: true }).check();
    const download = await generate(page),
      content = await bytes(download);
    if (format === "JSON") {
      const data = JSON.parse(content.toString());
      expect(Object.keys(data.sections)).toEqual(["Personal Profile"]);
      expect(data.notice).toContain("SYNTHETIC DEMO");
    }
    if (format === "CSV")
      expect(content.toString()).toContain('"Section","Field","Value"');
    if (format === "XLSX") {
      expect(content.subarray(0, 2).toString()).toBe("PK");
      expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
    }
    if (format === "PDF")
      expect(content.subarray(0, 5).toString()).toBe("%PDF-");
    await expect(
      page.getByRole("status").filter({ hasText: "Report downloaded." }),
    ).toBeVisible();
  }
  await page.reload();
  const history = page
    .getByRole("heading", { name: "Report History", exact: true })
    .locator("..");
  await expect(
    history.getByRole("button", { name: "Download", exact: true }),
  ).toHaveCount(4);
  const pending = page.waitForEvent("download");
  await history
    .getByRole("button", { name: "Download", exact: true })
    .first()
    .click();
  expect((await bytes(await pending)).subarray(0, 5).toString()).toBe("%PDF-");
});

test("case, network and executive reports contain their distinct sections", async ({
  page,
}) => {
  await enterDemo(page);
  await page.goto("/reports");
  await page.getByLabel("JSON", { exact: true }).check();
  for (const [type, section] of [
    ["Case Investigation Report", "Case Details"],
    ["Network Analysis Report", "Relationships"],
    ["Executive Summary Report", "Active Alerts"],
  ]) {
    await page.getByRole("button", { name: type, exact: true }).click();
    if (type.startsWith("Case"))
      await page.getByLabel("Case", { exact: true }).selectOption("case-1");
    const data = JSON.parse((await bytes(await generate(page))).toString());
    expect(data.sections).toHaveProperty(section);
    if (type.startsWith("Case"))
      expect(data.sections["Case Details"].id).toBe("case-1");
  }
});

test("assistant, real integrity checks and geographic filters", async ({
  page,
}) => {
  await enterDemo(page);
  await page.goto("/chat");
  await page
    .getByRole("button", { name: "Top 5 highest risk criminals", exact: true })
    .first()
    .click();
  await expect(page.getByText(/Five highest sample scores:/)).toBeVisible();
  await page
    .getByLabel("Question", { exact: true })
    .fill("Tell me tomorrow's arrest targets");
  await page.getByLabel("Send", { exact: true }).click();
  await expect(page.getByText(/I cannot predict crimes/)).toBeVisible();
  await page.goto("/blockchain");
  await page
    .getByRole("button", { name: "Save reference checksum", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Compare checksum", exact: true })
    .click();
  await expect(
    page.getByText("Checksums match — text is unchanged", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Change sample", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Compare checksum", exact: true })
    .click();
  await expect(
    page.getByText("Checksum mismatch — text has changed", { exact: true }),
  ).toBeVisible();
  await page.goto("/map");
  await expect(
    page.getByText("18 case records across 6 locations", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cyber Crime", exact: true }).click();
  await expect(
    page.getByText("4 case records across 4 locations", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("OpenStreetMap basemap (requires internet)"),
  ).not.toBeChecked();
});

test("public landing, invalid links and missing profiles never leave a stale or loading screen", async ({
  page,
}) => {
  await page.goto("/public");
  await expect(
    page.getByRole("heading", { name: "Report previews", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "View sample report", exact: true })
    .click();
  await expect(page.locator("pre")).toContainText("Network Summary");
  await page.goto("/public/report/not-a-valid-link");
  await expect(page.getByText(/This local preview is invalid/)).toBeVisible();
  await enterDemo(page);
  await page.goto("/criminal/raja-khan");
  await expect(
    page.getByRole("heading", { name: "Raja Khan", exact: true }),
  ).toBeVisible();
  await page.goto("/criminal/missing");
  await expect(
    page.getByText("Person not found", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Raja Khan", exact: true }),
  ).toHaveCount(0);
});

test("guided tour can pause, advance through every step and finish without crashing", async ({
  page,
}) => {
  await page.goto("/login");
  await page
    .getByRole("button", { name: "Start guided walkthrough", exact: true })
    .click();
  await expect(page.getByText(/Step 1 of 8/)).toBeVisible();
  await page.getByLabel("Pause demo", { exact: true }).click();
  await expect(page.getByLabel("Resume demo", { exact: true })).toBeVisible();
  for (let step = 2; step <= 8; step++) {
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByText(new RegExp(`Step ${step} of 8`))).toBeVisible();
  }
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "See the network behind the crime." }),
  ).toBeVisible();
  await expect(page.getByLabel("Exit demo", { exact: true })).toHaveCount(0);
});

test("notification preferences persist and reset restores original workspace", async ({
  page,
}) => {
  await enterDemo(page);
  await page.goto("/alerts");
  await page
    .getByRole("button", { name: "Trigger demo alert", exact: true })
    .click();
  await expect(page.getByRole("article")).toHaveCount(6);
  await page.goto("/settings");
  await expect(
    page.getByRole("heading", { name: "System Status", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Not connected", { exact: true })).toHaveCount(2);
  await page.getByLabel("Sound on critical / high alerts").check();
  await page.reload();
  await expect(
    page.getByLabel("Sound on critical / high alerts"),
  ).toBeChecked();
  await page
    .getByRole("button", { name: "Reset demo data", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Reset workspace", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "See the network behind the crime." }),
  ).toBeVisible();
  await page.goto("/alerts");
  await expect(page.getByRole("article")).toHaveCount(5);
});

test("mobile navigation works without horizontal page overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enterDemo(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByLabel("Open navigation", { exact: true }).click();
  await page
    .getByRole("link", { name: "Network Analysis", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Network Analysis", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Inspect entity").selectOption("raja-khan");
  await expect(
    page.getByRole("heading", { name: "Raja Khan", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
