import "server-only";

import { desc, eq, inArray } from "drizzle-orm";

import { db, schema, type Db } from "@/lib/db";
import { assertTenantId } from "@/lib/db/tenant";
import { createZip } from "@/lib/export/zip";

/**
 * Tenant data export (Day 5 brief 6): everything the agency owns as JSON files
 * in a zip. Photo bytes are never stored, so none are included; logos are
 * referenced by URL. Session tokens and login token hashes are excluded.
 */
export async function buildTenantExport(tenantId: string, conn: Db = db) {
  const id = assertTenantId(tenantId);
  const tenant = await conn.query.tenants.findFirst({ where: eq(schema.tenants.id, id) });
  if (!tenant) return null;

  const itineraries = await conn
    .select()
    .from(schema.itineraries)
    .where(eq(schema.itineraries.tenantId, id));
  const itinIds = itineraries.map((i) => i.id);
  const days = itinIds.length
    ? await conn.select().from(schema.days).where(inArray(schema.days.itineraryId, itinIds))
    : [];
  const dayIds = days.map((d) => d.id);
  const [stops, hotels, shareLinks] = await Promise.all([
    dayIds.length
      ? conn.select().from(schema.stops).where(inArray(schema.stops.dayId, dayIds))
      : [],
    dayIds.length
      ? conn.select().from(schema.hotels).where(inArray(schema.hotels.dayId, dayIds))
      : [],
    itinIds.length
      ? conn.select().from(schema.shareLinks).where(inArray(schema.shareLinks.itineraryId, itinIds))
      : [],
  ]);
  const [users, usage, audit, learnings, jobs] = await Promise.all([
    conn
      .select({
        id: schema.users.id,
        email: schema.users.email,
        role: schema.users.role,
        createdAt: schema.users.createdAt,
      })
      .from(schema.users)
      .where(eq(schema.users.tenantId, id)),
    conn.select().from(schema.usageEvents).where(eq(schema.usageEvents.tenantId, id)),
    conn
      .select()
      .from(schema.auditLog)
      .where(eq(schema.auditLog.tenantId, id))
      .orderBy(desc(schema.auditLog.createdAt)),
    conn.select().from(schema.tenantLearnings).where(eq(schema.tenantLearnings.tenantId, id)),
    conn
      .select({
        id: schema.generationJobs.id,
        kind: schema.generationJobs.kind,
        prompt: schema.generationJobs.prompt,
        status: schema.generationJobs.status,
        itineraryId: schema.generationJobs.itineraryId,
        error: schema.generationJobs.error,
        createdAt: schema.generationJobs.createdAt,
      })
      .from(schema.generationJobs)
      .where(eq(schema.generationJobs.tenantId, id)),
  ]);

  // Nest days → stops/hotels under each itinerary so one file reads on its own.
  const tree = itineraries.map((it) => ({
    ...it,
    share_links: shareLinks.filter((l) => l.itineraryId === it.id),
    days: days
      .filter((d) => d.itineraryId === it.id)
      .sort((a, b) => a.position - b.position)
      .map((d) => ({
        ...d,
        stops: stops.filter((s) => s.dayId === d.id).sort((a, b) => a.position - b.position),
        hotels: hotels.filter((h) => h.dayId === d.id),
      })),
  }));

  const json = (v: unknown) => JSON.stringify(v, null, 2);
  const exportedAt = new Date();
  const files = [
    {
      name: "README.txt",
      data: `Daywise data export for ${tenant.name} (${tenant.slug})\nExported ${exportedAt.toISOString()} (UTC)\n\nFiles: tenant.json, users.json, itineraries.json (with days, stops, hotels, share links), generation_jobs.json, usage_events.json, audit_log.json, learnings.json.\nPhotos are not included: Daywise stores Google photo references only, never the images.\n`,
    },
    { name: "tenant.json", data: json(tenant) },
    { name: "users.json", data: json(users) },
    { name: "itineraries.json", data: json(tree) },
    { name: "generation_jobs.json", data: json(jobs) },
    { name: "usage_events.json", data: json(usage) },
    { name: "audit_log.json", data: json(audit) },
    { name: "learnings.json", data: json(learnings) },
  ];
  const stamp = exportedAt.toISOString().slice(0, 10);
  return {
    filename: `daywise-${tenant.slug}-${stamp}.zip`,
    zip: createZip(files, exportedAt),
    counts: { itineraries: itineraries.length, days: days.length, users: users.length },
  };
}
