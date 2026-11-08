import { db, schema } from "@/lib/db";
import { logger } from "@/lib/logger";

import type { UsageReport } from "./providers";

/** Writes one `usage_events` row per AI call (kind `ai`, tokens in meta). */
export function recordAiUsage(tenantId: string | null) {
  return async (u: UsageReport) => {
    try {
      await db.insert(schema.usageEvents).values({
        tenantId,
        kind: "ai",
        costUnits: 1,
        meta: {
          provider: u.provider,
          model: u.model,
          op: u.op,
          tokens_in: u.tokensIn,
          tokens_out: u.tokensOut,
          ms: u.ms,
          ok: u.ok,
        },
      });
    } catch (err) {
      logger.error({ err }, "failed to record AI usage");
    }
  };
}
