import "server-only";

import { and, count, desc, eq, gte, ilike, isNull, or, sql } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import { startOfDayIST, startOfMonthIST } from "@/lib/format";

export type TenantUsage = {
  ai: number;
  tokens: number;
  placesSearch: number;
  placesPhoto: number;
  pdf: number;
};

const empty = (): TenantUsage => ({ ai: 0, tokens: 0, placesSearch: 0, placesPhoto: 0, pdf: 0 });

/** Usage this IST month per tenant (key "" = not attributable, e.g. the public photo proxy). */
export async function usageThisMonth(tenantId?: string) {
  const rows = await db
    .select({
      tenantId: schema.usageEvents.tenantId,
      kind: schema.usageEvents.kind,
      units: sql<number>`coalesce(sum(${schema.usageEvents.costUnits}), 0)::int`,
      tokens: sql<number>`coalesce(sum(coalesce((${schema.usageEvents.meta}->>'tokens_in')::int, 0) + coalesce((${schema.usageEvents.meta}->>'tokens_out')::int, 0)), 0)::int`,
    })
    .from(schema.usageEvents)
    .where(
      and(
        gte(schema.usageEvents.createdAt, startOfMonthIST()),
        tenantId ? eq(schema.usageEvents.tenantId, tenantId) : undefined,
      ),
    )
    .groupBy(schema.usageEvents.tenantId, schema.usageEvents.kind);

  const byTenant = new Map<string, TenantUsage>();
  const totals = empty();
  for (const r of rows) {
    const u = byTenant.get(r.tenantId ?? "") ?? empty();
    for (const target of [u, totals]) {
      if (r.kind === "ai") {
        target.ai += r.units;
        target.tokens += r.tokens;
      } else if (r.kind === "places_search") target.placesSearch += r.units;
      else if (r.kind === "places_photo") target.placesPhoto += r.units;
      else if (r.kind === "pdf") target.pdf += r.units;
    }
    byTenant.set(r.tenantId ?? "", u);
  }
  return { byTenant, totals };
}

export async function loadTenantsOverview(query: string) {
  const tenants = await db
    .select()
    .from(schema.tenants)
    .where(
      query
        ? or(ilike(schema.tenants.name, `%${query}%`), ilike(schema.tenants.slug, `%${query}%`))
        : undefined,
    )
    .orderBy(schema.tenants.createdAt);
  const [{ byTenant, totals }, itineraryRows] = await Promise.all([
    usageThisMonth(),
    db
      .select({ tenantId: schema.itineraries.tenantId, n: count() })
      .from(schema.itineraries)
      .where(and(isNull(schema.itineraries.deletedAt), eq(schema.itineraries.isTemplate, false)))
      .groupBy(schema.itineraries.tenantId),
  ]);
  const itineraries = new Map(itineraryRows.map((r) => [r.tenantId, r.n]));
  return {
    totals,
    rows: tenants.map((t) => ({
      tenant: t,
      usage: byTenant.get(t.id) ?? empty(),
      itineraries: itineraries.get(t.id) ?? 0,
    })),
  };
}

export async function loadTenantDetail(id: string) {
  const tenant = await db.query.tenants.findFirst({ where: eq(schema.tenants.id, id) });
  if (!tenant) return null;
  const [{ byTenant }, users, [gens], [itins], audit] = await Promise.all([
    usageThisMonth(id),
    db
      .select({ email: schema.users.email, role: schema.users.role })
      .from(schema.users)
      .where(eq(schema.users.tenantId, id)),
    db
      .select({ n: count() })
      .from(schema.generationJobs)
      .where(
        and(
          eq(schema.generationJobs.tenantId, id),
          gte(schema.generationJobs.createdAt, startOfDayIST()),
        ),
      ),
    db
      .select({ n: count() })
      .from(schema.itineraries)
      .where(and(eq(schema.itineraries.tenantId, id), isNull(schema.itineraries.deletedAt))),
    db
      .select({
        id: schema.auditLog.id,
        action: schema.auditLog.action,
        createdAt: schema.auditLog.createdAt,
        email: schema.users.email,
        entity: schema.auditLog.entity,
      })
      .from(schema.auditLog)
      .leftJoin(schema.users, eq(schema.users.id, schema.auditLog.userId))
      .where(eq(schema.auditLog.tenantId, id))
      .orderBy(desc(schema.auditLog.createdAt))
      .limit(20),
  ]);
  return {
    tenant,
    usage: byTenant.get(id) ?? empty(),
    users,
    generationsToday: gens?.n ?? 0,
    itineraries: itins?.n ?? 0,
    audit,
  };
}
