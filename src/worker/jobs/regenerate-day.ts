import { eq } from "drizzle-orm";

import { GenerationError, generateDay } from "@/lib/ai/generate";
import { learningsFor } from "@/lib/ai/learnings";
import { AIUnavailableError } from "@/lib/ai/providers";
import { parseStoredBrief } from "@/lib/ai/schemas";
import { recordAiUsage } from "@/lib/ai/usage";
import { db, schema } from "@/lib/db";
import type { GenerationProgress } from "@/lib/db/schema";
import { tenantScope } from "@/lib/db/tenant";
import { verifyItinerary } from "@/lib/itinerary/verify";
import type { GenerateJobData } from "@/lib/jobs/boss";
import { logger } from "@/lib/logger";

/**
 * pg-boss handler for `regenerate-day`: redrafts one day with the rest of the
 * itinerary as context, verifies it through Places, and replaces only that
 * day's title, summary, transport, stops, hotel and hero. Other days are not
 * touched. Progress lives on the same `generation_jobs` row the editor polls.
 */
export async function handleRegenerateDay(data: GenerateJobData): Promise<void> {
  const job = await db.query.generationJobs.findFirst({
    where: eq(schema.generationJobs.id, data.jobId),
  });
  if (!job || job.tenantId !== data.tenantId || job.kind !== "day") return;
  if (job.status === "done" || !job.itineraryId || !job.dayId) return;

  const log = logger.child({ jobId: job.id, tenantId: job.tenantId, dayId: job.dayId });
  const progress: GenerationProgress = { steps: [] };
  const update = (patch: Partial<typeof schema.generationJobs.$inferInsert>) =>
    db
      .update(schema.generationJobs)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(schema.generationJobs.id, job.id));

  try {
    const scope = tenantScope(job.tenantId);
    const tenant = await scope.getTenant();
    const tree = await scope.getItineraryTree(job.itineraryId);
    const brief = parseStoredBrief(tree.brief);
    if (!brief) throw new GenerationError("This itinerary has no brief to regenerate from.");
    const idx = tree.days.findIndex((d) => d.id === job.dayId);
    if (idx < 0) throw new GenerationError("That day is no longer in the itinerary.");

    await update({ status: "drafting" });
    let t = Date.now();
    const learnings = await learningsFor(job.tenantId, brief.destination).catch(() => undefined);
    const day = await generateDay(
      brief,
      tree.days.map((d, i) => ({
        day_number: i + 1,
        date: d.date,
        city: d.city ?? brief.cities[0] ?? brief.destination,
        title: d.title,
        stops: d.stops.map((s) => s.title),
        hotel: d.hotel?.name ?? null,
      })),
      idx + 1,
      learnings,
      { onUsage: recordAiUsage(job.tenantId) },
    );
    progress.steps.push({ name: "drafting", result: day.title, ms: Date.now() - t });

    await update({ status: "verifying", progress });
    t = Date.now();
    const verified = await verifyItinerary(
      { title: tree.title, summary: "", notes: [], days: [day] },
      brief,
      job.tenantId,
      tenant.branding.theme_color,
    );
    const s = verified.stats;
    progress.steps.push({
      name: "verifying",
      result: `${s.hotels}/${s.hotels_total} hotels and ${s.stops}/${s.stops_total} stops verified`,
      ms: Date.now() - t,
    });

    await scope.replaceDay(job.itineraryId, job.dayId, verified.days[0]!);
    await scope.audit("itinerary.regenerate_day", {
      entity: "itinerary",
      entityId: job.itineraryId,
      meta: { jobId: job.id, dayId: job.dayId, stats: s },
    });
    await update({ status: "done", progress, error: null });
    log.info({ stats: s }, "day regenerated");
  } catch (err) {
    const message =
      err instanceof GenerationError || err instanceof AIUnavailableError
        ? err.message
        : "Something went wrong while regenerating this day. Please try again.";
    log.error({ err }, "regenerate day failed");
    await update({ status: "failed", error: message, progress });
  }
}
