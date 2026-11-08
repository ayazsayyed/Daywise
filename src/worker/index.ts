import "../../scripts/load-env";
import { PgBoss } from "pg-boss";

import { env } from "@/lib/env";
import { logger as base } from "@/lib/logger";

/**
 * Background worker. Day 1: starts pg-boss and idles so the container is in
 * place; Day 2 registers the `generate-itinerary` handler, Day 4 the `render-pdf` one.
 */
const logger = base.child({ service: "worker" });

export const QUEUES = {
  generate: "generate-itinerary",
  pdf: "render-pdf",
} as const;

async function main() {
  const boss = new PgBoss({
    connectionString: env.DATABASE_URL,
    schema: "pgboss",
    application_name: "daywise-worker",
  });

  boss.on("error", (err) => logger.error({ err }, "pg-boss error"));

  await boss.start();
  for (const name of Object.values(QUEUES)) {
    await boss.createQueue(name);
  }
  logger.info({ queues: Object.values(QUEUES) }, "worker started (idle — no handlers yet)");

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "worker stopping");
    await boss.stop({ graceful: true, timeout: 10_000 });
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  logger.fatal({ err }, "worker failed to start");
  process.exit(1);
});
