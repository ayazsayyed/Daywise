import { PgBoss } from "pg-boss";

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

export const QUEUES = {
  generate: "generate-itinerary",
  pdf: "render-pdf",
} as const;

export type GenerateJobData = { jobId: string; tenantId: string };

declare global {
  var __daywiseBoss: Promise<PgBoss> | undefined;
}

/** One started pg-boss per process (app sends; worker also works queues). */
export function getBoss(): Promise<PgBoss> {
  globalThis.__daywiseBoss ??= (async () => {
    const boss = new PgBoss({
      connectionString: env.DATABASE_URL,
      schema: "pgboss",
      application_name: "daywise",
    });
    boss.on("error", (err) => logger.error({ err }, "pg-boss error"));
    await boss.start();
    for (const name of Object.values(QUEUES)) await boss.createQueue(name);
    return boss;
  })();
  return globalThis.__daywiseBoss;
}
