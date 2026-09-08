import { test, expect, type Page, type CDPSession } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

test.use({ baseURL: "http://localhost:3000" });
const errors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const list: string[] = [];
  errors.set(page, list);
  page.on("pageerror", (error) => list.push(error.message));
  await page.goto("/login");
  await page.getByRole("button", { name: "Explore demo", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "See the network behind the crime." }),
  ).toBeVisible();
});
test.afterEach(async ({ page }) => {
  expect(errors.get(page)).toEqual([]);
});
const file = (name: string, value: string) => ({
  name,
  mimeType: "application/octet-stream",
  buffer: Buffer.from(value),
});
const consent = (page: Page) =>
  page.getByRole("checkbox", { name: /I consent to this device/ });
async function virtualDevice(
  page: Page,
): Promise<{ session: CDPSession; id: string }> {
  const session = await page.context().newCDPSession(page);
  await session.send("WebAuthn.enable");
  const result = await session.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  return { session, id: result.authenticatorId };
}
async function register(page: Page) {
  await page.goto("/fingerprints?tab=device");
  await expect(
    page.getByText("A user-verifying device authenticator is available.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Register this device", exact: true }),
  ).toBeDisabled();
  await consent(page).check();
  await page
    .getByRole("button", { name: "Register this device", exact: true })
    .click();
  await expect(
    page.getByText("Device credential registered locally.", { exact: true }),
  ).toBeVisible();
}

test("file fingerprints use real hashes, clear stale verdicts, and export a checksum record", async ({
  page,
}) => {
  await page.goto("/fingerprints");
  const expected = createHash("sha256")
    .update("synthetic file bytes")
    .digest("hex");
  await page
    .getByLabel("File to fingerprint", { exact: true })
    .setInputFiles(file("reference.bin", "synthetic file bytes"));
  await page
    .getByRole("button", { name: "Calculate SHA-256", exact: true })
    .click();
  await expect(page.getByTestId("calculated-file-fingerprint")).toHaveText(
    expected,
  );
  await page
    .getByLabel("Reference SHA-256", { exact: true })
    .fill(expected.toUpperCase());
  await page
    .getByRole("button", { name: "Verify file integrity", exact: true })
    .click();
  await expect(
    page.getByText("Fingerprint matches the supplied reference.", {
      exact: true,
    }),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download checksum record", exact: true })
    .click();
  const data = JSON.parse(
    await readFile((await (await download).path())!, "utf8"),
  );
  expect(data).toMatchObject({
    algorithm: "SHA-256",
    matches: true,
    sha256: expected,
  });
  expect(data).not.toHaveProperty("contents");
  await page
    .getByLabel("Reference SHA-256", { exact: true })
    .fill("a".repeat(64));
  await expect(
    page.getByText("Fingerprint matches the supplied reference.", {
      exact: true,
    }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Verify file integrity", exact: true })
    .click();
  await expect(
    page.getByText(
      "Fingerprint mismatch — the file differs from the supplied reference.",
      { exact: true },
    ),
  ).toBeVisible();
  await page
    .getByLabel("Reference SHA-256", { exact: true })
    .fill("not-a-hash");
  await expect(
    page.getByRole("button", { name: "Verify file integrity", exact: true }),
  ).toBeDisabled();
});

test("compares two different-named files by content and remains usable on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/fingerprints");
  await page
    .getByLabel("File to fingerprint", { exact: true })
    .setInputFiles(file("first.png", "equal bytes"));
  await page.getByLabel("Compare another file", { exact: true }).check();
  await page
    .getByLabel("Reference file", { exact: true })
    .setInputFiles(file("other.pdf", "equal bytes"));
  await page
    .getByRole("button", { name: "Verify file integrity", exact: true })
    .click();
  await expect(
    page.getByText("Fingerprint matches the supplied reference.", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByLabel("Reference file", { exact: true })
    .setInputFiles(file("first.png", "different bytes"));
  await page
    .getByRole("button", { name: "Verify file integrity", exact: true })
    .click();
  await expect(
    page.getByText(
      "Fingerprint mismatch — the file differs from the supplied reference.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("device registration and verification validate an actual virtual-authenticator assertion without changing access", async ({
  page,
}) => {
  await virtualDevice(page);
  const access = await page.evaluate(() =>
    localStorage.getItem("crimenet_demo_access_token"),
  );
  const posts: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST") posts.push(request.url());
  });
  await register(page);
  await expect(consent(page)).not.toBeChecked();
  await consent(page).check();
  await page
    .getByRole("button", { name: "Verify registered device", exact: true })
    .click();
  await expect(
    page.getByText("Registered authenticator verified for this challenge.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      localStorage.getItem("crimenet_demo_access_token"),
    ),
  ).toBe(access);
  expect(posts).toEqual([]);
  const record = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((key) =>
      key.includes(":device-credential:v1:"),
    )!;
    return JSON.parse(localStorage.getItem(key)!);
  });
  expect(record.algorithm).toBe("ES256");
  expect(record.lastVerifiedAt).toBeTruthy();
  expect(record).not.toHaveProperty("privateKey");
  expect(record).not.toHaveProperty("fingerprint");
  expect(record).not.toHaveProperty("biometricTemplate");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Verify registered device", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Registered authenticator verified for this challenge.", {
      exact: true,
    }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Forget local registration", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Forget registration", exact: true })
    .click();
  await expect(
    page.getByText("Local device registration forgotten.", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).filter((key) =>
        key.includes(":device-credential:v1:"),
      ),
    ),
  ).toEqual([]);
});

test("device verification can be cancelled without saving a successful verdict", async ({
  page,
}) => {
  const { session, id } = await virtualDevice(page);
  await register(page);
  await session.send("WebAuthn.setAutomaticPresenceSimulation", {
    authenticatorId: id,
    enabled: false,
  });
  await consent(page).check();
  await page
    .getByRole("button", { name: "Verify registered device", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Cancel device prompt", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("cancelled");
  await expect(
    page.getByText("Registered authenticator verified for this challenge.", {
      exact: true,
    }),
  ).toHaveCount(0);
  const lastVerified = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((key) =>
      key.includes(":device-credential:v1:"),
    )!;
    return JSON.parse(localStorage.getItem(key)!).lastVerifiedAt;
  });
  expect(lastVerified).toBeUndefined();
});

test("registrations are isolated between demo accounts", async ({ page }) => {
  await virtualDevice(page);
  await register(page);
  await page.getByRole("button", { name: "Logout", exact: true }).click();
  await page
    .getByLabel("Badge / Employee ID", { exact: true })
    .fill("officer@crimenet.gov.in");
  await page.getByLabel("Password", { exact: true }).fill("Officer@123");
  await page.locator('form button[type="submit"]').click();
  await expect(
    page.getByRole("heading", { name: "See the network behind the crime." }),
  ).toBeVisible();
  await page.goto("/fingerprints?tab=device");
  await expect(
    page.getByText("No device registered for this account on this website.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Verify registered device", exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () =>
        Object.keys(localStorage).filter((key) =>
          key.includes(":device-credential:v1:"),
        ).length,
    ),
  ).toBe(1);
});

test("unsupported devices and embedded previews show an honest unavailable state", async ({
  page,
}) => {
  const session = await page.context().newCDPSession(page);
  await session.send("WebAuthn.enable");
  await page.goto("/fingerprints?tab=device");
  await expect(
    page.getByText(/No platform authenticator is available/),
  ).toBeVisible();
  await consent(page).check();
  await expect(
    page.getByRole("button", { name: "Register this device", exact: true }),
  ).toBeDisabled();
  await page.setContent(
    '<iframe title="Embedded fingerprint demo" src="http://localhost:3000/fingerprints?tab=device" style="width:100%;height:900px"></iframe>',
  );
  const frame = page.frameLocator('iframe[title="Embedded fingerprint demo"]');
  await expect(frame.getByText(/open this page in a new tab/)).toBeVisible();
  await expect(
    frame.getByRole("button", { name: "Register this device", exact: true }),
  ).toBeDisabled();
  await expect(
    frame.getByRole("link", {
      name: "Open biometric verification in a new tab",
      exact: true,
    }),
  ).toHaveAttribute("target", "_blank");
});
