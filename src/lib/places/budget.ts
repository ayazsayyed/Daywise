import { and, gte, eq, sql } from "drizzle-orm";

import { alert } from "@/lib/alerts";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { startOfMonthIST } from "@/lib/format";

/**
 * Hard monthly budget guard for Google Places. Caps come from env; usage is
 * the sum of `usage_events` for the calendar month (IST). When a cap is
 * reached, `spend` returns false: generation continues unverified and an
 * alert goes to Sentry. The guard is global (one Google bill), not per tenant.
 */
export type BudgetKind = "places_search" | "places_photo";

export type BudgetDeps = {
  caps: Record<BudgetKind, number>;
  /** Units already used this month. */
  count: (kind: BudgetKind) => Promise<number>;
  /** Persist one spend. */
  record: (kind: BudgetKind, tenantId: string | null, units: number) => Promise<void>;
  alert: (kind: BudgetKind, used: number, cap: number) => Promise<void>;
  now?: () => number;
  /** How long a counted total is trusted before re-reading the DB. */
  cacheMs?: number;
};

export type BudgetState = { kind: BudgetKind; used: number; cap: number; exhausted: boolean };

export function createBudgetGuard(deps: BudgetDeps) {
  const cache = new Map<BudgetKind, { used: number; at: number; month: string }>();
  const now = deps.now ?? Date.now;
  const cacheMs = deps.cacheMs ?? 60_000;
  const monthKey = () => startOfMonthIST(new Date(now())).toISOString();

  async function used(kind: BudgetKind): Promise<number> {
    const c = cache.get(kind);
    const m = monthKey();
    if (c && c.month === m && now() - c.at < cacheMs) return c.used;
    const n = await deps.count(kind);
    cache.set(kind, { used: n, at: now(), month: m });
    return n;
  }

  return {
    async state(kind: BudgetKind): Promise<BudgetState> {
      const u = await used(kind);
      const cap = deps.caps[kind];
      return { kind, used: u, cap, exhausted: u >= cap };
    },

    /** Reserves `units`; false when the month's cap is already reached. */
    async spend(kind: BudgetKind, tenantId: string | null, units = 1): Promise<boolean> {
      const u = await used(kind);
      const cap = deps.caps[kind];
      if (u + units > cap) {
        await deps.alert(kind, u, cap);
        return false;
      }
      await deps.record(kind, tenantId, units);
      const c = cache.get(kind);
      if (c) c.used += units;
      return true;
    },

    _reset() {
      cache.clear();
    },
  };
}

export type BudgetGuard = ReturnType<typeof createBudgetGuard>;

let instance: BudgetGuard | undefined;

/** Process-wide guard backed by `usage_events`. */
export function placesBudget(): BudgetGuard {
  instance ??= createBudgetGuard({
    caps: {
      places_search: env.PLACES_MONTHLY_TEXT_SEARCH_CAP,
      places_photo: env.PLACES_MONTHLY_PHOTO_CAP,
    },
    async count(kind) {
      const [row] = await db
        .select({ n: sql<number>`coalesce(sum(${schema.usageEvents.costUnits}), 0)::int` })
        .from(schema.usageEvents)
        .where(
          and(
            eq(schema.usageEvents.kind, kind),
            gte(schema.usageEvents.createdAt, startOfMonthIST()),
          ),
        );
      return row?.n ?? 0;
    },
    async record(kind, tenantId, units) {
      await db.insert(schema.usageEvents).values({ tenantId, kind, costUnits: units });
    },
    async alert(kind, usedUnits, cap) {
      await alert(
        "warning",
        `places-budget:${kind}`,
        `Google Places monthly budget exhausted for ${kind} (${usedUnits}/${cap}); continuing unverified`,
        { kind, used: usedUnits, cap },
      );
    },
  });
  return instance;
}
