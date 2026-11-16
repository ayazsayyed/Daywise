import { devices, expect, test } from "@playwright/test";

import {
  createTestItinerary,
  createTestTenant,
  deleteStaleTestTenants,
  deleteTenants,
  requireDb,
  signIn,
  type TestTenant,
} from "./helpers";

/**
 * Day 4 e2e: login → generate (mocked AI locally, real AI on the live site) →
 * share link renders. Runs inside a throwaway e2e tenant, deleted afterwards.
 *
 * Locally needs the app and worker running with fixtures:
 *   MOCK_AI=1 pnpm dev      MOCK_AI=1 pnpm worker      pnpm e2e
 * Login uses the real magic-link path: the test writes a one-time login token
 * (what the email would carry) and opens /auth/verify with it.
 */

let tenant: TestTenant;
test.beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;
  await deleteStaleTestTenants();
  tenant = await createTestTenant("share");
});
test.afterAll(async () => {
  if (tenant) await deleteTenants([tenant.id]);
});

test("login → generate → share link renders on a phone", async ({ page, browser }) => {
  test.setTimeout(150_000);
  requireDb();
  await signIn(page, tenant.email, /\/app/);

  // Generate through the real flow (fixtures when MOCK_AI=1).
  await page.goto("/app/new");
  await page.getByRole("textbox").first().fill("5-day Kashmir couple mid-range");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Client name").fill("E2E Client");
  await page.getByRole("button", { name: "Generate itinerary" }).click();
  await page.waitForURL(/\/app\/i\/[0-9a-f-]{36}$/, { timeout: 90_000 });
  const title = (
    await page.locator("header").first().locator("span").first().textContent()
  )?.trim();

  // Share panel: link is on, copyable; first share moves Draft → Sent.
  await page.waitForLoadState("load");
  await page.waitForTimeout(1500); // hydration
  await page.getByRole("button", { name: "Share", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "Share itinerary" });
  const linkField = panel.getByRole("textbox", { name: "Share link" });
  await expect(linkField).toHaveValue(/\/s\/[A-Za-z0-9_-]{24,}$/);
  const url = await linkField.inputValue();
  const wa = await panel.getByRole("link", { name: "Share on WhatsApp" }).getAttribute("href");
  expect(decodeURIComponent(wa ?? "")).toContain(`itinerary from`);
  expect(decodeURIComponent(wa ?? "")).toContain(url);

  // The client opens it on a phone.
  const phone = await browser.newContext({ ...devices["iPhone 13"] });
  const client = await phone.newPage();
  const res = await client.goto(url);
  expect(res?.headers()["x-robots-tag"]).toContain("noindex");
  await expect(client.getByRole("heading", { level: 1 })).toHaveText(title ?? /.+/);
  await expect(client.locator("[data-day]")).toHaveCount(5);
  await expect(client.getByText("Departure day · no hotel")).toBeVisible();
  await expect(client.locator("body")).not.toContainText("Daywise");
  expect(await client.locator('meta[name="robots"]').getAttribute("content")).toContain("noindex");

  // Turning the link off shows the friendly page with the agency, never Daywise.
  await panel.getByRole("switch", { name: "Link sharing" }).click();
  await expect(panel.getByRole("switch", { name: "Link sharing" })).toHaveAttribute(
    "aria-checked",
    "false",
  );
  // "Disabling the link shows the friendly page within seconds."
  await expect(async () => {
    await client.reload();
    await expect(client.getByRole("heading", { level: 1 })).toHaveText(
      "This itinerary is no longer available",
      { timeout: 500 },
    );
  }).toPass({ timeout: 10_000 });
  await expect(client.locator("body")).not.toContainText("Daywise");

  // And back on.
  await panel.getByRole("switch", { name: "Link sharing" }).click();
  await expect(panel.getByRole("switch", { name: "Link sharing" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(async () => {
    await client.reload();
    await expect(client.locator("[data-day]")).toHaveCount(5, { timeout: 500 });
  }).toPass({ timeout: 10_000 });
  await phone.close();
});

test("unknown token shows the calm unavailable page, unbranded", async ({ page }) => {
  await page.goto("/s/this-token-does-not-exist-0000000");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "This itinerary is no longer available",
  );
  await expect(page.locator("body")).not.toContainText("Daywise");
});

test("PDF style switch → a Heritage PDF renders through the worker", async ({ page }) => {
  test.setTimeout(150_000);
  requireDb();
  const it = await createTestItinerary(tenant.id, "E2E Heritage trip");
  await signIn(page, tenant.email, /\/app/);

  // Settings → PDF: pick Heritage, serif title, a gold accent; save.
  await page.goto("/app/settings");
  await page.waitForLoadState("load");
  await page.waitForTimeout(1500); // hydration
  await page.getByRole("radio", { name: /Heritage/ }).click();
  await page.getByRole("radio", { name: "Fraunces serif" }).click();
  await page.getByLabel("Accent colour").fill("#C9A227");
  await page.getByRole("button", { name: "Save changes" }).click();
  // Saving re-renders the form from the server; nothing left to save means it landed.
  await expect(page.getByRole("button", { name: "Save changes" })).toBeDisabled({
    timeout: 15_000,
  });
  await page.reload();
  await expect(page.getByRole("radio", { name: /Heritage/ })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(page.getByRole("radio", { name: "Fraunces serif" })).toHaveAttribute(
    "aria-checked",
    "true",
  );

  // Download the PDF from the share panel: cover + 2 days + last page, numbers stamped.
  await page.goto(`/app/i/${it.id}`);
  await page.waitForLoadState("load");
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "Share", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "Share itinerary" });
  const download = page.waitForEvent("download", { timeout: 90_000 });
  await panel.getByRole("button", { name: "Download PDF" }).click();
  const file = await download;
  const bytes = await new Promise<Buffer>((resolve, reject) => {
    void file.createReadStream().then((s) => {
      const chunks: Buffer[] = [];
      s.on("data", (c: Buffer) => chunks.push(c));
      s.on("end", () => resolve(Buffer.concat(chunks)));
      s.on("error", reject);
    });
  });
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  const { PDFDocument } = await import("pdf-lib");
  const doc = await PDFDocument.load(bytes);
  expect(doc.getPageCount()).toBe(4);
  // The client page itself is unchanged by the style.
  const client = await page.context().newPage();
  await client.goto(`/s/${it.token}`);
  await expect(client.locator("[data-day]")).toHaveCount(2);
  await expect(client.locator("body")).not.toContainText("Private travel itinerary");
  await client.close();
});
