import { randomBytes } from "node:crypto";

import { and, eq, lt, sql } from "drizzle-orm";

import { db, type Db } from "./index";
import { itineraryRepo, NotFoundError, type ItineraryTree } from "./itinerary";
import * as schema from "./schema";

/**
 * Public share access. The ONLY way a share page finds its tenant: token →
 * link → itinerary → tenant. Nothing from the URL path, host or body is used
 * to pick a tenant. Tenant-scoped management (enable, disable) lives in
 * `tenantScope` (src/lib/db/itinerary.ts).
 */

/** 24 random bytes → 32 url-safe characters (CLAUDE.md: 24+ chars, unguessable). */
export function mintShareToken(): string {
  return randomBytes(24).toString("base64url");
}

export const SHARE_TOKEN_RE = /^[A-Za-z0-9_-]{24,64}$/;

/** Suspended tenants keep links read-only for 30 days (CLAUDE.md). */
export const SUSPENDED_GRACE_DAYS = 30;

export type ShareTenant = typeof schema.tenants.$inferSelect;
export type ShareLink = typeof schema.shareLinks.$inferSelect;

export type ShareResolution =
  | { kind: "ok"; link: ShareLink; tenant: ShareTenant; tree: ItineraryTree }
  /** Link off, itinerary deleted or a template, or tenant suspended past the grace period. */
  | { kind: "disabled"; tenant: ShareTenant }
  | { kind: "not_found" };

export function suspendedPastGrace(tenant: ShareTenant, now = new Date()): boolean {
  if (tenant.status !== "suspended") return false;
  if (!tenant.suspendedAt) return true;
  return now.getTime() - tenant.suspendedAt.getTime() > SUSPENDED_GRACE_DAYS * 86_400_000;
}

/** Link + tenant only (cheap): used to brand the unavailable page when the tree fails. */
export async function shareTenantByToken(token: string, conn: Db = db) {
  if (!SHARE_TOKEN_RE.test(token)) return null;
  const link = await conn.query.shareLinks.findFirst({
    where: eq(schema.shareLinks.token, token),
    with: {
      itinerary: { columns: { id: true, tenantId: true, deletedAt: true, isTemplate: true } },
    },
  });
  if (!link) return null;
  const tenant = await conn.query.tenants.findFirst({
    where: eq(schema.tenants.id, link.itinerary.tenantId),
  });
  return tenant ? { link, tenant } : null;
}

export async function resolveShare(
  token: string,
  conn: Db = db,
  opts: { allowDisabledLink?: boolean } = {},
): Promise<ShareResolution> {
  const found = await shareTenantByToken(token, conn);
  if (!found) return { kind: "not_found" };
  const { link, tenant } = found;
  if (
    (!link.enabled && !opts.allowDisabledLink) ||
    link.itinerary.deletedAt ||
    link.itinerary.isTemplate ||
    suspendedPastGrace(tenant)
  )
    return { kind: "disabled", tenant };
  try {
    const tree = await itineraryRepo(tenant.id, conn).getItineraryTree(link.itinerary.id);
    return { kind: "ok", link, tenant, tree };
  } catch (err) {
    if (err instanceof NotFoundError) return { kind: "disabled", tenant };
    throw err;
  }
}

/**
 * Counts a view once per link, device and hour. Returns true when it counted.
 * Old de-dupe rows (> 2 h) for this link are pruned on the way.
 */
export async function recordShareView(
  linkId: string,
  visitor: string,
  hour: Date,
  device: "mobile" | "desktop",
  conn: Db = db,
): Promise<boolean> {
  return conn.transaction(async (tx) => {
    const inserted = await tx
      .insert(schema.shareViews)
      .values({ linkId, visitor, hour })
      .onConflictDoNothing()
      .returning({ linkId: schema.shareViews.linkId });
    if (!inserted.length) return false;
    await tx
      .update(schema.shareLinks)
      .set({
        viewCount: sql`${schema.shareLinks.viewCount} + 1`,
        lastViewedAt: new Date(),
        lastViewedDevice: device,
      })
      .where(eq(schema.shareLinks.id, linkId));
    await tx
      .delete(schema.shareViews)
      .where(
        and(
          eq(schema.shareViews.linkId, linkId),
          lt(schema.shareViews.hour, new Date(hour.getTime() - 2 * 3_600_000)),
        ),
      );
    return true;
  });
}
