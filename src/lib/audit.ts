import "server-only";

import { db, schema } from "@/lib/db";
import { logger } from "@/lib/logger";

/**
 * Audit entries that are not inside one tenant's own session: logins and
 * superadmin actions on tenants. Tenant-session actions use `tenantScope().audit`.
 * Never throws: an audit write failure is logged, not shown to the user.
 */
export async function auditEvent(
  action: string,
  opts: {
    tenantId?: string | null;
    userId?: string | null;
    entity?: string;
    entityId?: string;
    meta?: Record<string, unknown>;
  } = {},
) {
  try {
    await db.insert(schema.auditLog).values({
      tenantId: opts.tenantId ?? null,
      userId: opts.userId ?? null,
      action,
      entity: opts.entity ?? null,
      entityId: opts.entityId ?? null,
      meta: opts.meta ?? null,
    });
  } catch (err) {
    logger.error({ err, action }, "audit write failed");
  }
}
