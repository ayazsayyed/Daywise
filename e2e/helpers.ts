import { createHash, randomBytes } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";

/**
 * Shared e2e setup. Tests create their own throwaway tenants (slug `e2e-…`,
 * owner `…@e2e.test`, which never receives mail) and delete them afterwards,
 * so the suite can run against production without touching real agencies.
 * Needs DATABASE_URL pointing at the target database (locally the dev DB;
 * for the live site an SSH tunnel, see .github/workflows/e2e-live.yml).
 */
export const SUPERADMIN = (
  process.env.E2E_EMAIL ??
  process.env.SUPERADMIN_EMAIL ??
  ""
).toLowerCase();

export function requireDb() {
  test.skip(!process.env.DATABASE_URL, "DATABASE_URL is required");
}

export function sqlClient() {
  return postgres(process.env.DATABASE_URL!, { max: 2, onnotice: () => {} });
}

export const rand = () => randomBytes(4).toString("hex");

/** One-time login token, as the magic-link email would carry, then /auth/verify. */
export async function signIn(page: Page, email: string, expectUrl: RegExp = /\/(app|admin)/) {
  const sql = sqlClient();
  const token = randomBytes(32).toString("base64url");
  await sql`insert into login_tokens (email, token_hash, expires_at)
            values (${email.toLowerCase()}, ${createHash("sha256").update(token).digest("hex")}, now() + interval '15 minutes')`;
  await sql.end();
  await page.goto(`/auth/verify?token=${encodeURIComponent(token)}`);
  await expect(page).toHaveURL(expectUrl);
}

const BRANDING = {
  logo_url: null,
  theme_color: "#1F6B4A",
  phone: "+91 98000 00000",
  whatsapp: "+91 98000 00000",
  email: "",
  website: "",
  address: "",
  gstin: "",
  licence_no: "",
  tagline: "",
  contact_person: "",
  footer: "",
};
const DEFAULTS = { inclusions: "", exclusions: "", payment_terms: "", cancellation: "" };

export type TestTenant = { id: string; slug: string; name: string; email: string };

export async function createTestTenant(label: string): Promise<TestTenant> {
  const sql = sqlClient();
  const r = rand();
  const slug = `e2e-${label}-${r}`;
  const name = `E2E ${label.toUpperCase()} ${r}`;
  const email = `owner-${label}-${r}@e2e.test`;
  const [t] = await sql<{ id: string }[]>`
    insert into tenants (slug, name, status, plan, branding, defaults)
    values (${slug}, ${name}, 'active', 'standard', ${sql.json(BRANDING)}, ${sql.json(DEFAULTS)})
    returning id`;
  await sql`insert into users (email, role, tenant_id) values (${email}, 'admin', ${t!.id})`;
  await sql.end();
  return { id: t!.id, slug, name, email };
}

/** A minimal 2-day itinerary with an enabled share link, written directly. */
export async function createTestItinerary(tenantId: string, title: string) {
  const sql = sqlClient();
  const [it] = await sql<{ id: string }[]>`
    insert into itineraries (tenant_id, title, status, start_date, end_date, pricing, sections)
    values (${tenantId}, ${title}, 'draft', '2027-03-14', '2027-03-15',
      ${sql.json({ mode: "total", show: false, total: null, per_person: null, per_adult: null, per_child: null, currency: "INR" })},
      ${sql.json(DEFAULTS)})
    returning id`;
  const [d1] = await sql<{ id: string }[]>`
    insert into days (itinerary_id, position, date, city, title, summary)
    values (${it!.id}, 0, '2027-03-14', 'Srinagar', 'Arrive in Srinagar', 'Check in and rest.') returning id`;
  await sql`insert into days (itinerary_id, position, date, city, title, summary)
            values (${it!.id}, 1, '2027-03-15', 'Srinagar', 'Departure', 'Transfer to the airport.')`;
  await sql`insert into stops (day_id, position, title, description, time)
            values (${d1!.id}, 0, 'Dal Lake shikara ride', 'An hour on the lake at sunset.', '17:00')`;
  await sql`insert into hotels (day_id, name, city) values (${d1!.id}, 'Test Houseboat', 'Srinagar')`;
  const token = randomBytes(24).toString("base64url");
  await sql`insert into share_links (itinerary_id, token, enabled) values (${it!.id}, ${token}, true)`;
  const [job] = await sql<{ id: string }[]>`
    insert into generation_jobs (tenant_id, itinerary_id, prompt, status)
    values (${tenantId}, ${it!.id}, 'e2e', 'done') returning id`;
  await sql.end();
  return { id: it!.id, token, jobId: job!.id };
}

export async function deleteTenants(ids: string[]) {
  if (!ids.length) return;
  const sql = sqlClient();
  await sql`delete from tenants where id in ${sql(ids)}`;
  await sql.end();
}

/** Safety net: anything an aborted run left behind. */
export async function deleteStaleTestTenants() {
  const sql = sqlClient();
  await sql`delete from tenants where slug like 'e2e-%' and created_at < now() - interval '1 hour'`;
  await sql`delete from users where email like '%@e2e.test' and tenant_id is null`;
  await sql.end();
}
