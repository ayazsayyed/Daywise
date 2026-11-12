import "../../scripts/load-env";

import { getBoss, QUEUES, type GenerateJobData } from "@/lib/jobs/boss";
import { logger as base } from "@/lib/logger";

import { handleGenerate } from "./jobs/generate";
import { handleRegenerateDay } from "./jobs/regenerate-day";
import {
  closePdfBrowser,
  handleRenderPdf,
  sweepPdfJobs,
  warmPdfBrowser,
  type RenderPdfData,
} from "./jobs/render-pdf";

/**
 * Background worker: pg-boss queues from the same codebase, separate process.
 * `generate-itinerary`, `regenerate-day` and (Day 4) `render-pdf`.
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
  await boss.work<GenerateJobData>(
    QUEUES.regenerateDay,
    { batchSize: 1, pollingIntervalSeconds: 1 },
    async ([job]) => {
      if (!job) return;
      logger.info({ id: job.id, data: job.data }, "regenerate-day start");
      await handleRegenerateDay(job.data);
    },
  );
  await boss.work<RenderPdfData>(
    QUEUES.pdf,
    { batchSize: 1, pollingIntervalSeconds: 1 },
    async ([job]) => {
      if (!job) return;
      logger.info({ id: job.id, data: job.data }, "render-pdf start");
      await handleRenderPdf(job.data);
    },
  );
  warmPdfBrowser();
  const sweep = setInterval(
    () =>
      void sweepPdfJobs()
        .then((n) => n && logger.info({ n }, "swept old PDFs"))
        .catch((err) => logger.warn({ err }, "pdf sweep failed")),
    5 * 60_000,
  );
  logger.info({ queues: Object.values(QUEUES) }, "worker started");

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "worker stopping");
    clearInterval(sweep);
    await boss.stop({ graceful: true, timeout: 10_000 });
    await closePdfBrowser();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  logger.fatal({ err }, "worker failed to start");
  process.exit(1);
});
