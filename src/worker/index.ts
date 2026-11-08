import "../../scripts/load-env";

import { getBoss, QUEUES, type GenerateJobData } from "@/lib/jobs/boss";
import { logger as base } from "@/lib/logger";

import { handleGenerate } from "./jobs/generate";

/**
 * Background worker: pg-boss queues from the same codebase, separate process.
 * Day 2 registers `generate-itinerary`; Day 4 adds `render-pdf`.
 */
const logger = base.child({ service: "worker" });

async function main() {
  const boss = await getBoss();

  await boss.work<GenerateJobData>(
    QUEUES.generate,
    { batchSize: 1, pollingIntervalSeconds: 1 },
    async ([job]) => {
      if (!job) return;
      logger.info({ id: job.id, data: job.data }, "generate-itinerary start");
      await handleGenerate(job.data);
    },
  );
  logger.info({ queues: Object.values(QUEUES) }, "worker started");

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
