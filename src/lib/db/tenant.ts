import { and, eq, isNull, type SQL } from "drizzle-orm";
import { z } from "zod";

import type { Brief } from "@/lib/ai/schemas";
import type { VerifiedItinerary } from "@/lib/itinerary/verify";

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

    async updateName(name: string) {
      const clean = z.string().trim().min(2).max(80).parse(name);
      const [row] = await conn
        .update(schema.tenants)
        .set({ name: clean, updatedAt: new Date() })
        .where(eq(schema.tenants.id, id))
        .returning();
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

    /**
     * Persists a generated itinerary (itinerary + days + stops + hotels) in one
     * transaction. Sections come from the tenant's defaults; pricing starts
     * hidden and empty — prices are agent-entered only.
     */
    async createGeneratedItinerary(input: {
      brief: Brief;
      itinerary: VerifiedItinerary;
      prompt: string;
      defaults: schema.TenantDefaults;
    }) {
      const { brief, itinerary } = input;
      const dates = itinerary.days.map((d) => d.date).filter((d): d is string => !!d);
      return conn.transaction(async (tx) => {
        const [row] = await tx
          .insert(schema.itineraries)
          .values({
            tenantId: id,
            title: itinerary.title,
            status: "draft",
            client: null,
            brief: {
              ...brief,
              prompt: input.prompt,
              summary: itinerary.summary,
              notes: itinerary.notes,
            },
            startDate: dates[0] ?? null,
            endDate: dates[dates.length - 1] ?? null,
            pricing: {
              mode: "total",
              show: false,
              total: null,
              per_person: null,
              per_adult: null,
              per_child: null,
              currency: brief.currency,
            },
            sections: { ...input.defaults },
          })
          .returning();
        if (!row) throw new Error("insert itinerary failed");

        for (const [i, d] of itinerary.days.entries()) {
          const [day] = await tx
            .insert(schema.days)
            .values({
              itineraryId: row.id,
              position: i,
              date: d.date,
              title: d.title,
              summary: d.summary,
              transport: d.transport,
              heroImage: d.hero_image,
            })
            .returning({ id: schema.days.id });
          if (!day) throw new Error("insert day failed");

          if (d.stops.length) {
            await tx.insert(schema.stops).values(
              d.stops.map((s, position) => ({
                dayId: day.id,
                position,
                kind: s.kind,
                title: s.title,
                description: [s.time, s.description].filter(Boolean).join(" · ") || null,
                duration: s.duration,
                placeId: s.place_id,
                verified: s.verified,
                image: s.image,
              })),
            );
          }
          if (d.hotel) {
            await tx.insert(schema.hotels).values({
              dayId: day.id,
              name: d.hotel.name,
              placeId: d.hotel.place_id,
              verified: d.hotel.verified,
              roomType: d.hotel.room_type,
              mealPlan: d.hotel.meal_plan,
              checkIn: d.hotel.check_in,
              checkOut: d.hotel.check_out,
              address: d.hotel.address,
              image: d.hotel.image,
              manual: false,
            });
          }
        }
        return row;
      });
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
