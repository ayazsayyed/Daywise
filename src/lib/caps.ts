import { and, count, eq, gte, sum } from "drizzle-orm";

import type { Db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { assertTenantId } from "@/lib/db/tenant";
import { startOfDayIST, startOfMonthIST } from "@/lib/format";

/**
 * Per-tenant caps, enforced when a generation is enqueued (Day 5 brief 2):
 * - `daily_gen_cap`: generations (full + regenerate-day) per IST day;
 * - `monthly_ai_cap`: AI calls per IST calendar month (usage_events kind=ai).
 * PDFs have their own monthly cap at render time (Day 4).
 */
export class CapExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CapExceededError";
  }
}

export type CapInput = {
  generationsToday: number;
  dailyGenCap: number;
  aiCallsThisMonth: number;
  monthlyAiCap: number;
};

/** Pure decision: null = allowed, else the agent-facing message. */
export function capMessage(c: CapInput): string | null {
  if (c.generationsToday >= c.dailyGenCap)
    return `Today's limit of ${c.dailyGenCap} generations is used up. It resets at midnight IST; edit existing itineraries meanwhile.`;
  if (c.aiCallsThisMonth >= c.monthlyAiCap)
    return `This month's AI limit (${c.monthlyAiCap} calls) is used up. Write to support to raise it.`;
  return null;
}

export async function assertGenerationAllowed(conn: Db, tenantId: string, now = new Date()) {
  const id = assertTenantId(tenantId);
  const tenant = await conn.query.tenants.findFirst({
    columns: { dailyGenCap: true, monthlyAiCap: true, status: true },
    where: eq(schema.tenants.id, id),
  });
  if (!tenant) throw new CapExceededError("Agency not found.");
  if (tenant.status === "suspended") throw new CapExceededError("This agency is suspended.");
  const [[gens], [ai]] = await Promise.all([
    conn
      .select({ n: count() })
      .from(schema.generationJobs)
      .where(
        and(
          eq(schema.generationJobs.tenantId, id),
          gte(schema.generationJobs.createdAt, startOfDayIST(now)),
        ),
      ),
    conn
      .select({ n: sum(schema.usageEvents.costUnits) })
      .from(schema.usageEvents)
      .where(
        and(
          eq(schema.usageEvents.tenantId, id),
          eq(schema.usageEvents.kind, "ai"),
          gte(schema.usageEvents.createdAt, startOfMonthIST(now)),
        ),
      ),
  ]);
  const msg = capMessage({
    generationsToday: gens?.n ?? 0,
    dailyGenCap: tenant.dailyGenCap,
    aiCallsThisMonth: Number(ai?.n ?? 0),
    monthlyAiCap: tenant.monthlyAiCap,
  });
  if (msg) throw new CapExceededError(msg);
}
