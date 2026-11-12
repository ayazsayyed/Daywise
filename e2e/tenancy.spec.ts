import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

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
 * Day 5 acceptance: a second tenant cannot see or guess another tenant's data.
 * Tenant A owns an itinerary, a share link and a generation job; tenant B
 * signs in and tries every route that takes an id.
 */
let a: TestTenant;
let b: TestTenant;
let itA: Awaited<ReturnType<typeof createTestItinerary>>;
let itB: Awaited<ReturnType<typeof createTestItinerary>>;

test.beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;
  await deleteStaleTestTenants();
  a = await createTestTenant("a");
  b = await createTestTenant("b");
  itA = await createTestItinerary(a.id, `Secret Kashmir for A ${a.slug}`);
  itB = await createTestItinerary(b.id, `Kerala for B ${b.slug}`);
});
test.afterAll(async () => {
  await deleteTenants([a?.id, b?.id].filter(Boolean) as string[]);
});

test("tenant B cannot open, list or export tenant A's data", async ({ page }) => {
  requireDb();
  await signIn(page, b.email, /\/app/);

  // B's own list shows B's itinerary, never A's.
  await page.goto("/app");
  await expect(page.getByRole("link", { name: `Kerala for B ${b.slug}` }).first()).toBeVisible();
  await expect(page.locator("body")).not.toContainText(a.slug);

  // A's editor and generation job: 404 for B, and nothing of A leaks.
  for (const path of [`/app/i/${itA.id}`, `/app/new/${itA.jobId}`]) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(404);
    await expect(page.locator("body")).not.toContainText("Secret Kashmir");
  }
  // B's own editor works (control).
  expect((await page.goto(`/app/i/${itB.id}`))?.status()).toBe(200);

  // B cannot reach the super-admin area or A's admin export.
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/app$/);
  const exportA = await page.request.get(`/admin/t/${a.id}/export`, { maxRedirects: 0 });
  expect(exportA.status()).not.toBe(200);

  // B's own export contains B's itinerary and nothing of A.
  const res = await page.request.get("/app/settings/export");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toBe("application/zip");
  const dir = mkdtempSync(join(tmpdir(), "dw-export-"));
  writeFileSync(join(dir, "b.zip"), await res.body());
  execFileSync("unzip", ["-q", "-o", join(dir, "b.zip"), "-d", dir]);
  const itins = readFileSync(join(dir, "itineraries.json"), "utf8");
  expect(itins).toContain(itB.id);
  expect(itins).not.toContain(itA.id);
  expect(readFileSync(join(dir, "tenant.json"), "utf8")).toContain(b.slug);
});

test("share links resolve by token only; guesses get the unbranded page", async ({ page }) => {
  requireDb();
  // A's real token renders A's itinerary for anyone (that is the point of a link).
  await page.goto(`/s/${itA.token}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    `Secret Kashmir for A ${a.slug}`,
  );
  // Near-miss tokens never resolve and never show A's brand.
  const near = itA.token.slice(0, -1) + (itA.token.endsWith("A") ? "B" : "A");
  for (const t of [near, "x".repeat(32), itA.id]) {
    const res = await page.goto(`/s/${t}`);
    expect(res?.status()).toBe(404);
    await expect(page.locator("body")).not.toContainText(a.name);
  }
});
