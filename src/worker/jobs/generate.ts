import { eq } from "drizzle-orm";

import { BriefError } from "@/lib/ai/enhance";
import { GenerationError } from "@/lib/ai/generate";
import { AIUnavailableError } from "@/lib/ai/providers";
import { briefSchema } from "@/lib/ai/schemas";
import { db, schema } from "@/lib/db";
import type { GenerationProgress } from "@/lib/db/schema";
import { tenantScope } from "@/lib/db/tenant";
import { runPipeline, type PipelineProgress } from "@/lib/itinerary/pipeline";
import type { GenerateJobData } from "@/lib/jobs/boss";
import { logger } from "@/lib/logger";

/**
 * pg-boss handler for `generate-itinerary`. Reads the job row, runs the
 * pipeline, updates status + progress after every step (the UI polls the
 * row), persists through the tenant scope and records the itinerary id.
 * Failures end as `failed` with a user-readable error.
 */
export async function handleGenerate(data: GenerateJobData): Promise<void> {
  const job = await db.query.generationJobs.findFirst({
    where: eq(schema.generationJobs.id, data.jobId),
  });
  if (!job || job.tenantId !== data.tenantId) {
    logger.warn({ data }, "generation job not found or tenant mismatch");
    return;
  }
  if (job.status === "done") return;

  const scope = tenantScope(job.tenantId);
  const tenant = await scope.getTenant();
  const progress: GenerationProgress = { steps: [] };
  const log = logger.child({ jobId: job.id, tenantId: job.tenantId });

  const update = (patch: Partial<typeof schema.generationJobs.$inferInsert>) =>
    db
      .update(schema.generationJobs)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(schema.generationJobs.id, job.id));

  const onProgress = async (p: PipelineProgress) => {
    if (p.result !== undefined) {
      progress.steps.push({ name: p.step, result: p.result, ms: p.ms ?? 0 });
      if (p.days) progress.days = p.days;
    }
    await update({ status: p.step, progress });
  };

  try {
    const parsedBrief = job.brief ? briefSchema.safeParse(job.brief) : null;
    const out = await runPipeline({
      tenantId: job.tenantId,
      prompt: job.prompt,
      brief: parsedBrief?.success ? parsedBrief.data : null,
      themeColor: tenant.branding.theme_color,
      onProgress,
    });
    const s = out.itinerary.stats;
    progress.verified = {
      hotels: s.hotels,
      hotels_total: s.hotels_total,
      stops: s.stops,
      stops_total: s.stops_total,
    };
    const row = await scope.createGeneratedItinerary({
      brief: out.brief,
      itinerary: out.itinerary,
      prompt: job.prompt,
      defaults: tenant.defaults,
    });
    await scope.audit("itinerary.generate", {
      entity: "itinerary",
      entityId: row.id,
      meta: { jobId: job.id, stats: s, timings: out.timings },
    });
    await update({ status: "done", itineraryId: row.id, brief: out.brief, progress, error: null });
    log.info({ itineraryId: row.id, stats: s, timings: out.timings }, "generation done");
  } catch (err) {
    const message =
      err instanceof BriefError ||
      err instanceof GenerationError ||
      err instanceof AIUnavailableError
        ? err.message
        : "Something went wrong while drafting. Please try again.";
    log.error({ err }, "generation failed");
    await update({ status: "failed", error: message, progress });
  }
}
