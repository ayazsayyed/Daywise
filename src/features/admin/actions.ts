"use server";

import { Resolver } from "node:dns/promises";

import { and, eq, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auditEvent } from "@/lib/audit";
import { requireSuperadmin } from "@/lib/auth/guards";
import { issueMagicLink } from "@/lib/auth/magic";
import { revokeTenantSessions, setActingTenant } from "@/lib/auth/session";
import { tenantSubdomain, TENANT_DOMAIN_SUFFIX } from "@/lib/config/brand";
import { db, schema } from "@/lib/db";
import { DEFAULT_BRANDING, DEFAULT_DEFAULTS } from "@/lib/db/json";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { deletePrefix, r2Configured } from "@/lib/storage/r2";

import { cnameVerdict, HOSTNAME_RE, RESERVED_SLUGS, SLUG_RE, type CnameVerdict } from "./cname";

/**
 * Super-admin mutations (Day 5 brief 1). Every action re-checks the superadmin
 * session and writes an audit row. Tenant ids here come from the admin UI on
 * purpose: this is the one place that acts across tenants.
 */
const uuid = z.string().uuid();

export type FormResult =
  { ok: true; message?: string } | { ok: false; message: string; field?: string };

const capsSchema = z.object({
  dailyGenCap: z.coerce.number().int().min(0).max(10_000),
  monthlyAiCap: z.coerce.number().int().min(0).max(1_000_000),
  monthlyPdfCap: z.coerce.number().int().min(0).max(100_000),
});

const createSchema = capsSchema.extend({
  name: z.string().trim().min(2, "Enter the agency name").max(80),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(SLUG_RE, "Use 1–32 lowercase letters, digits or hyphens")
    .refine((s) => !RESERVED_SLUGS.has(s), "That subdomain is reserved"),
  ownerEmail: z.string().trim().toLowerCase().email("Enter a valid email address"),
  customDomain: z
    .string()
    .trim()
    .toLowerCase()
    .refine((d) => d === "" || HOSTNAME_RE.test(d), "Enter a domain like itinerary.agency.com")
    .refine((d) => !d.endsWith(TENANT_DOMAIN_SUFFIX), "Leave blank to use the subdomain"),
  plan: z.enum(["trial", "standard"]),
});

export async function slugAvailable(slug: string): Promise<boolean> {
  await requireSuperadmin();
  const s = slug.trim().toLowerCase();
  if (!SLUG_RE.test(s) || RESERVED_SLUGS.has(s)) return false;
  const row = await db.query.tenants.findFirst({
    columns: { id: true },
    where: eq(schema.tenants.slug, s),
  });
  return !row;
}

export async function createTenant(_prev: FormResult | null, form: FormData): Promise<FormResult> {
  const session = await requireSuperadmin();
  const parsed = createSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    return { ok: false, message: i?.message ?? "Check the form", field: String(i?.path[0] ?? "") };
  }
  const v = parsed.data;

  const clash = await db.query.tenants.findFirst({
    columns: { slug: true, customDomain: true },
    where: sql`${schema.tenants.slug} = ${v.slug} or (${v.customDomain} <> '' and ${schema.tenants.customDomain} = ${v.customDomain})`,
  });
  if (clash)
    return clash.slug === v.slug
      ? { ok: false, message: "That subdomain is taken", field: "slug" }
      : { ok: false, message: "Another agency uses that domain", field: "customDomain" };
  const existingUser = await db.query.users.findFirst({
    columns: { id: true },
    where: sql`lower(${schema.users.email}) = ${v.ownerEmail}`,
  });
  if (existingUser)
    return { ok: false, message: "That email already has a Daywise login", field: "ownerEmail" };

  const tenant = await db.transaction(async (tx) => {
    const [t] = await tx
      .insert(schema.tenants)
      .values({
        name: v.name,
        slug: v.slug,
        customDomain: v.customDomain || null,
        plan: v.plan,
        status: v.plan === "trial" ? "trial" : "active",
        dailyGenCap: v.dailyGenCap,
        monthlyAiCap: v.monthlyAiCap,
        monthlyPdfCap: v.monthlyPdfCap,
        branding: { ...DEFAULT_BRANDING, email: v.ownerEmail },
        defaults: { ...DEFAULT_DEFAULTS },
      })
      .returning();
    await tx.insert(schema.users).values({ email: v.ownerEmail, role: "admin", tenantId: t!.id });
    return t!;
  });

  await auditEvent("admin.tenant.create", {
    tenantId: tenant.id,
    userId: session.user.id,
    entity: "tenant",
    entityId: tenant.id,
    meta: { slug: v.slug, plan: v.plan, owner: v.ownerEmail, customDomain: v.customDomain || null },
  });

  revalidatePath("/admin");
  // Reserved test TLDs (RFC 2606/6761) never get mail: e2e runs create these.
  if (/\.(test|example|invalid|localhost)$/.test(v.ownerEmail))
    return { ok: true, message: `${v.name} created. Test address, so no sign-in email was sent.` };
  try {
    await issueMagicLink(v.ownerEmail);
    return { ok: true, message: `${v.name} created. A sign-in link went to ${v.ownerEmail}.` };
  } catch (err) {
    logger.error({ err }, "owner sign-in link not sent");
    return {
      ok: true,
      message: `${v.name} created, but the sign-in email failed. The owner can request one at /login.`,
    };
  }
}

async function loadTenant(id: string) {
  if (!uuid.safeParse(id).success) return null;
  return db.query.tenants.findFirst({ where: eq(schema.tenants.id, id) });
}

const sameName = (a: string, b: string) =>
  a.trim().replace(/\s+/g, " ").toLowerCase() === b.trim().replace(/\s+/g, " ").toLowerCase();

/** Suspend: admin locked (sessions revoked), shared links read-only for 30 days. */
export async function suspendTenant(tenantId: string, confirmName: string): Promise<FormResult> {
  const session = await requireSuperadmin();
  const tenant = await loadTenant(tenantId);
  if (!tenant) return { ok: false, message: "Tenant not found" };
  if (!sameName(confirmName, tenant.name))
    return { ok: false, message: "Type the agency name exactly to confirm" };
  if (tenant.status === "suspended") return { ok: true };
  await db
    .update(schema.tenants)
    .set({ status: "suspended", suspendedAt: new Date(), updatedAt: new Date() })
    .where(eq(schema.tenants.id, tenant.id));
  await revokeTenantSessions(tenant.id);
  await auditEvent("admin.tenant.suspend", {
    tenantId: tenant.id,
    userId: session.user.id,
    entity: "tenant",
    entityId: tenant.id,
    meta: { previous: tenant.status },
  });
  revalidatePath("/admin");
  return { ok: true, message: `${tenant.name} is suspended. Links stay readable for 30 days.` };
}

export async function unsuspendTenant(tenantId: string): Promise<FormResult> {
  const session = await requireSuperadmin();
  const tenant = await loadTenant(tenantId);
  if (!tenant) return { ok: false, message: "Tenant not found" };
  const status = tenant.plan === "trial" ? "trial" : "active";
  await db
    .update(schema.tenants)
    .set({ status, suspendedAt: null, updatedAt: new Date() })
    .where(eq(schema.tenants.id, tenant.id));
  await auditEvent("admin.tenant.unsuspend", {
    tenantId: tenant.id,
    userId: session.user.id,
    entity: "tenant",
    entityId: tenant.id,
    meta: { status },
  });
  revalidatePath("/admin");
  return { ok: true, message: `${tenant.name} is ${status} again.` };
}

export async function updateTenantSettings(
  tenantId: string,
  _prev: FormResult | null,
  form: FormData,
): Promise<FormResult> {
  const session = await requireSuperadmin();
  const tenant = await loadTenant(tenantId);
  if (!tenant) return { ok: false, message: "Tenant not found" };
  const parsed = capsSchema
    .extend({
      plan: z.enum(["trial", "standard"]),
      customDomain: createSchema.shape.customDomain,
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form" };
  const v = parsed.data;
  if (v.customDomain) {
    const clash = await db.query.tenants.findFirst({
      columns: { id: true },
      where: and(eq(schema.tenants.customDomain, v.customDomain), ne(schema.tenants.id, tenant.id)),
    });
    if (clash) return { ok: false, message: "Another agency uses that domain" };
  }
  const status =
    tenant.status === "suspended" ? "suspended" : v.plan === "trial" ? "trial" : "active";
  await db
    .update(schema.tenants)
    .set({
      dailyGenCap: v.dailyGenCap,
      monthlyAiCap: v.monthlyAiCap,
      monthlyPdfCap: v.monthlyPdfCap,
      plan: v.plan,
      status,
      customDomain: v.customDomain || null,
      updatedAt: new Date(),
    })
    .where(eq(schema.tenants.id, tenant.id));
  await auditEvent("admin.tenant.update", {
    tenantId: tenant.id,
    userId: session.user.id,
    entity: "tenant",
    entityId: tenant.id,
    meta: {
      before: {
        dailyGenCap: tenant.dailyGenCap,
        monthlyAiCap: tenant.monthlyAiCap,
        monthlyPdfCap: tenant.monthlyPdfCap,
        plan: tenant.plan,
        customDomain: tenant.customDomain,
      },
      after: { ...v, customDomain: v.customDomain || null },
    },
  });
  revalidatePath(`/admin/t/${tenant.id}`);
  revalidatePath("/admin");
  return { ok: true, message: "Saved" };
}

/** Delete tenant: everything cascades; logos under tenants/<id>/ removed from R2. */
export async function deleteTenant(tenantId: string, confirmName: string): Promise<FormResult> {
  const session = await requireSuperadmin();
  const tenant = await loadTenant(tenantId);
  if (!tenant) return { ok: false, message: "Tenant not found" };
  if (!sameName(confirmName, tenant.name))
    return { ok: false, message: "Type the agency name exactly to confirm" };

  const [counts] = await db.execute<{ itineraries: number; users: number }>(
    sql`select (select count(*) from itineraries where tenant_id = ${tenant.id})::int as itineraries,
               (select count(*) from users where tenant_id = ${tenant.id})::int as users`,
  );
  await revokeTenantSessions(tenant.id);
  await db.transaction(async (tx) => {
    // A superadmin attached to this tenant keeps their login (detached, not deleted).
    await tx
      .update(schema.users)
      .set({ tenantId: null })
      .where(and(eq(schema.users.tenantId, tenant.id), eq(schema.users.role, "superadmin")));
    await tx.delete(schema.tenants).where(eq(schema.tenants.id, tenant.id));
  });
  let files = 0;
  if (r2Configured()) {
    files = await deletePrefix(`tenants/${tenant.id}/`).catch((err) => {
      logger.error({ err, tenantId: tenant.id }, "tenant R2 cleanup failed");
      return -1;
    });
  }
  await auditEvent("admin.tenant.delete", {
    userId: session.user.id,
    entity: "tenant",
    entityId: tenant.id,
    meta: { slug: tenant.slug, name: tenant.name, ...counts, r2_files: files },
  });
  revalidatePath("/admin");
  redirect("/admin?deleted=1");
}

/** "Login as tenant": this session acts for the tenant until "Return to admin". */
export async function loginAsTenant(tenantId: string) {
  const session = await requireSuperadmin();
  const tenant = await loadTenant(tenantId);
  if (!tenant) redirect("/admin");
  await setActingTenant(session.id, tenant.id);
  await auditEvent("admin.impersonate.start", {
    tenantId: tenant.id,
    userId: session.user.id,
    entity: "tenant",
    entityId: tenant.id,
  });
  redirect("/app");
}

export async function stopActingAsTenant() {
  const session = await requireSuperadmin();
  if (session.impersonating && session.tenant) {
    await auditEvent("admin.impersonate.stop", {
      tenantId: session.tenant.id,
      userId: session.user.id,
      entity: "tenant",
      entityId: session.tenant.id,
    });
  }
  await setActingTenant(session.id, null);
  redirect("/admin");
}

export type CnameCheck = {
  domain: string;
  expected: { cname: string[]; a: string[] };
  actual: { cname: string[]; a: string[] };
  verdict: CnameVerdict;
};

async function lookup(fn: () => Promise<string[]>): Promise<string[]> {
  try {
    return await fn();
  } catch {
    return [];
  }
}

export async function checkCname(tenantId: string): Promise<CnameCheck | { error: string }> {
  await requireSuperadmin();
  const tenant = await loadTenant(tenantId);
  if (!tenant) return { error: "Tenant not found" };
  if (!tenant.customDomain) return { error: "No custom domain set" };
  const resolver = new Resolver({ timeout: 3000, tries: 2 });
  const appHost = new URL(env.APP_URL).hostname;
  const expectedTargets = [tenantSubdomain(tenant.slug), appHost];
  const [cname, a, appIps] = await Promise.all([
    lookup(() => resolver.resolveCname(tenant.customDomain!)),
    lookup(() => resolver.resolve4(tenant.customDomain!)),
    lookup(() => resolver.resolve4(appHost)),
  ]);
  return {
    domain: tenant.customDomain,
    expected: { cname: [expectedTargets[0]!], a: appIps },
    actual: { cname, a },
    verdict: cnameVerdict({ expectedTargets, appIps, cnames: cname, aRecords: a }),
  };
}
