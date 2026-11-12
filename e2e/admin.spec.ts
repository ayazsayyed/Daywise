import { expect, test, type Browser } from "@playwright/test";

import {
  createTestItinerary,
  createTestTenant,
  deleteStaleTestTenants,
  deleteTenants,
  rand,
  requireDb,
  signIn,
  SUPERADMIN,
  sqlClient,
  type TestTenant,
} from "./helpers";

/**
 * Day 5 acceptance: suspend → admin locked, links still render; unsuspend
 * restores. Also create + delete tenant and "login as tenant" through the UI.
 */
let t: TestTenant;
let it: Awaited<ReturnType<typeof createTestItinerary>>;
const created: string[] = [];

test.beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;
  await deleteStaleTestTenants();
  t = await createTestTenant("susp");
  it = await createTestItinerary(t.id, `Suspend check ${t.slug}`);
});
test.afterAll(async () => {
  await deleteTenants([t?.id, ...created].filter(Boolean) as string[]);
});

async function agentContext(browser: Browser) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await signIn(page, t.email, /\/app/);
  return { ctx, page };
}

test("suspend locks the agency, keeps links readable; reactivate restores", async ({
  page,
  browser,
}) => {
  requireDb();
  test.skip(!SUPERADMIN, "SUPERADMIN_EMAIL is required");
  const agent = await agentContext(browser);

  await signIn(page, SUPERADMIN);
  await page.goto(`/admin?q=${encodeURIComponent(t.slug)}`);
  const row = page.getByRole("row").filter({ hasText: t.name });
  await row.getByRole("button", { name: "Suspend" }).click();
  // Wrong name is refused.
  await page.getByLabel("Type the agency name to confirm").fill("not the name");
  await page.getByRole("button", { name: "Suspend tenant" }).click();
  await expect(page.getByText("Type the agency name exactly to confirm")).toBeVisible();
  await page.getByLabel("Type the agency name to confirm").fill(t.name);
  await page.getByRole("button", { name: "Suspend tenant" }).click();
  await expect(page.getByText(`${t.name} is suspended`)).toBeVisible();
  await page.reload();
  await expect(page.getByRole("row").filter({ hasText: t.name })).toContainText("Suspended");

  // Agent's session is revoked; signing in again lands on the suspended page.
  await agent.page.goto("/app");
  await expect(agent.page).toHaveURL(/\/login/);
  await signIn(agent.page, t.email, /\/suspended/);
  await agent.page.goto("/app/settings");
  await expect(agent.page).toHaveURL(/\/suspended/);

  // Client link still renders (read-only grace period).
  const client = await browser.newPage();
  await client.goto(`/s/${it.token}`);
  await expect(client.getByRole("heading", { level: 1 })).toHaveText(`Suspend check ${t.slug}`);

  // Reactivate.
  await page
    .getByRole("row")
    .filter({ hasText: t.name })
    .getByRole("button", { name: "Reactivate" })
    .click();
  await expect(page.getByText(`${t.name} is active again`)).toBeVisible();
  await agent.page.goto("/app");
  await expect(agent.page).toHaveURL(/\/app$/);
  await expect(
    agent.page.getByRole("link", { name: `Suspend check ${t.slug}` }).first(),
  ).toBeVisible();

  // Past the 30-day grace the link shows the friendly unavailable page.
  const sql = sqlClient();
  await sql`update tenants set status = 'suspended', suspended_at = now() - interval '31 days' where id = ${t.id}`;
  await client.reload();
  await expect(client.getByRole("heading", { level: 1 })).toHaveText(
    "This itinerary is no longer available",
  );
  await sql`update tenants set status = 'active', suspended_at = null where id = ${t.id}`;
  await sql.end();

  // The audit log recorded both actions.
  const sql2 = sqlClient();
  const actions = await sql2<{ action: string }[]>`
    select action from audit_log where tenant_id = ${t.id} order by created_at`;
  await sql2.end();
  expect(actions.map((r) => r.action)).toEqual(
    expect.arrayContaining(["admin.tenant.suspend", "admin.tenant.unsuspend", "auth.login"]),
  );
  await agent.ctx.close();
});

test("create tenant, open as it, return, delete it", async ({ page }) => {
  requireDb();
  test.skip(!SUPERADMIN, "SUPERADMIN_EMAIL is required");
  const r = rand();
  const name = `E2E Created ${r}`;
  const slug = `e2e-made-${r}`;
  await signIn(page, SUPERADMIN);
  await page.goto("/admin");
  await page.waitForTimeout(1000); // hydration
  const card = page.getByRole("region", { name: "Create tenant" });
  await card.getByLabel("Agency name").fill(name);
  await card.getByLabel("Subdomain").fill(slug);
  await expect(card.getByText("Available")).toBeVisible();
  await card.getByLabel("Owner email").fill(`owner-${r}@e2e.test`);
  await card.getByRole("button", { name: "Create tenant" }).click();
  await expect(card.getByRole("status")).toContainText(`${name} created`);

  const sql = sqlClient();
  const [row] = await sql<{ id: string }[]>`select id from tenants where slug = ${slug}`;
  await sql.end();
  created.push(row!.id);

  // Duplicate subdomain is refused.
  await card.getByLabel("Agency name").fill(`${name} again`);
  await card.getByLabel("Subdomain").fill(slug);
  await card.getByLabel("Owner email").fill(`other-${r}@e2e.test`);
  await card.getByRole("button", { name: "Create tenant" }).click();
  await expect(card.getByText("That subdomain is taken")).toBeVisible();

  // Login as tenant: banner, the tenant's (empty) list, then back to admin.
  await page.goto(`/admin/t/${row!.id}`);
  await page.getByRole("button", { name: `Open as ${name}` }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole("status").filter({ hasText: "Viewing as" })).toContainText(name);
  await page.getByRole("button", { name: "Return to admin" }).click();
  await expect(page).toHaveURL(/\/admin$/);

  // Delete with type-to-confirm.
  await page.goto(`/admin/t/${row!.id}`);
  await page.getByRole("button", { name: "Delete tenant…" }).click();
  await page.getByLabel("Type the agency name to confirm").fill(name);
  await page.getByRole("button", { name: "Delete tenant", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\?deleted=1/);
  const sql2 = sqlClient();
  const left = await sql2`select 1 from tenants where id = ${row!.id}`;
  const audit = await sql2<{ meta: { slug: string } }[]>`
    select meta from audit_log where action = 'admin.tenant.delete' and entity_id = ${row!.id}`;
  await sql2.end();
  expect(left).toHaveLength(0);
  expect(audit[0]?.meta.slug).toBe(slug);
});
