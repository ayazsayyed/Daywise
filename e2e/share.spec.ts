import { createHash, randomBytes } from "node:crypto";

import { devices, expect, test, type Page } from "@playwright/test";
import postgres from "postgres";

/**
 * Day 4 e2e: login → generate (mocked AI) → share link renders.
 *
 * Needs the app and worker running with fixtures:
 *   MOCK_AI=1 pnpm dev      MOCK_AI=1 pnpm worker      pnpm e2e
 * Login uses the real magic-link path: the test writes a one-time login token
 * (what the email would carry) and opens /auth/verify with it.
 */

const EMAIL = (process.env.E2E_EMAIL ?? process.env.SUPERADMIN_EMAIL ?? "").toLowerCase();

async function signIn(page: Page) {
  test.skip(!process.env.DATABASE_URL || !EMAIL, "DATABASE_URL and SUPERADMIN_EMAIL are required");
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  const token = randomBytes(32).toString("base64url");
  await sql`insert into login_tokens (email, token_hash, expires_at)
            values (${EMAIL}, ${createHash("sha256").update(token).digest("hex")}, now() + interval '15 minutes')`;
  await sql.end();
  await page.goto(`/auth/verify?token=${encodeURIComponent(token)}`);
  await expect(page).toHaveURL(/\/app/);
}

test("login → generate (mock AI) → share link renders on a phone", async ({ page, browser }) => {
  test.setTimeout(120_000);
  await signIn(page);

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
