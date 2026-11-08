import { desc } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import { tenantWhere } from "@/lib/db/tenant";

import type { Learnings } from "./generate";

/**
 * Reads `tenant_learnings` for a destination and turns them into one-line
 * preferences appended to the generation prompt. Rows are written by the
 * editor (Day 3) on hotel swaps and manual stop additions.
 */
export async function learningsFor(tenantId: string, destination: string): Promise<Learnings> {
  const rows = await db
    .select()
    .from(schema.tenantLearnings)
    .where(tenantWhere(schema.tenantLearnings, tenantId))
    .orderBy(desc(schema.tenantLearnings.createdAt))
    .limit(200);

  const dest = destination.trim().toLowerCase();
  const prefs: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (row.destination.trim().toLowerCase() !== dest) continue;
    const line = describe(row.kind, row.payload);
    if (!line || seen.has(line)) continue;
    seen.add(line);
    prefs.push(line);
    if (prefs.length >= 12) break;
  }
  return { preferences: prefs };
}

function describe(kind: string, p: Record<string, unknown>): string | null {
  const s = (k: string) => (typeof p[k] === "string" ? (p[k] as string).trim() : "");
  switch (kind) {
    case "hotel_swap":
      return s("to") && s("city")
        ? `In ${s("city")}, prefers ${s("to")}${s("from") ? ` over ${s("from")}` : ""}`
        : null;
    case "stop_added":
      return s("title") && s("city") ? `Usually adds "${s("title")}" in ${s("city")}` : null;
    case "stop_removed":
      return s("title") ? `Usually drops "${s("title")}"` : null;
    case "note":
      return s("text") || null;
    default:
      return null;
  }
}
