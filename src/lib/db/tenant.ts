import { and, eq, isNull, type SQL } from "drizzle-orm";
import { z } from "zod";

import { db, type Db } from "./index";
import * as schema from "./schema";
import { tenantBrandingSchema, tenantDefaultsSchema } from "./json";

/**
 * Tenant isolation layer. Every query that touches tenant-owned data MUST go
 * through a `TenantScope` created from the *session's* tenant id — never from a
 * request body, query string or URL segment. Public share pages resolve the
 * tenant from the share token only (see src/features/share, Day 4).
 */

const tenantIdSchema = z.string().uuid();

export class TenantIsolationError extends Error {
  constructor(message = "Invalid or missing tenant id") {
    super(message);
    this.name = "TenantIsolationError";
  }
}

/** Validates a tenant id coming from the session. Throws on anything that is not a UUID. */
export function assertTenantId(value: unknown): string {
  const parsed = tenantIdSchema.safeParse(value);
  if (!parsed.success) throw new TenantIsolationError();
  return parsed.data;
}

type TenantOwnedTable =
  | typeof schema.itineraries
  | typeof schema.usageEvents
  | typeof schema.auditLog
  | typeof schema.tenantLearnings;

/**
 * Builds a WHERE clause that always includes `tenant_id = $tenantId`.
 * Extra conditions are AND-ed on; `undefined` entries are ignored.
 */
export function tenantWhere(
  table: TenantOwnedTable,
  tenantId: string,
  ...extra: (SQL | undefined)[]
): SQL {
  const id = assertTenantId(tenantId);
  const clauses = [eq(table.tenantId, id), ...extra.filter((c): c is SQL => c !== undefined)];
  return and(...clauses) as SQL;
}

export type TenantScope = ReturnType<typeof tenantScope>;

/** Scoped data access for one tenant. Construct only from a verified session. */
export function tenantScope(tenantId: string, conn: Db = db) {
  const id = assertTenantId(tenantId);

  return {
    tenantId: id,

    async getTenant() {
      const row = await conn.query.tenants.findFirst({ where: eq(schema.tenants.id, id) });
      if (!row) throw new TenantIsolationError("Tenant not found");
      return row;
    },

    async updateBranding(input: unknown) {
      const branding = tenantBrandingSchema.parse(input);
      const [row] = await conn
        .update(schema.tenants)
        .set({ branding, updatedAt: new Date() })
        .where(eq(schema.tenants.id, id))
        .returning();
      if (!row) throw new TenantIsolationError("Tenant not found");
      return row;
    },

    async updateDefaults(input: unknown) {
      const defaults = tenantDefaultsSchema.parse(input);
      const [row] = await conn
        .update(schema.tenants)
        .set({ defaults, updatedAt: new Date() })
        .where(eq(schema.tenants.id, id))
        .returning();
      if (!row) throw new TenantIsolationError("Tenant not found");
      return row;
    },

    /** Live, non-template itineraries for the dashboard. */
    async listItineraries() {
      return conn.query.itineraries.findMany({
        where: tenantWhere(
          schema.itineraries,
          id,
          isNull(schema.itineraries.deletedAt),
          eq(schema.itineraries.isTemplate, false),
        ),
        orderBy: (t, { desc }) => [desc(t.updatedAt)],
      });
    },

    async audit(
      action: string,
      opts: {
        userId?: string | null;
        entity?: string;
        entityId?: string;
        meta?: Record<string, unknown>;
      } = {},
    ) {
      await conn.insert(schema.auditLog).values({
        tenantId: id,
        userId: opts.userId ?? null,
        action,
        entity: opts.entity ?? null,
        entityId: opts.entityId ?? null,
        meta: opts.meta ?? null,
      });
    },
  };
}
