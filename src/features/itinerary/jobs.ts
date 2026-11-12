import "server-only";

import { and, eq } from "drizzle-orm";

import type { Brief } from "@/lib/ai/schemas";
import { db, schema } from "@/lib/db";
import type { ItineraryClient } from "@/lib/db/schema";
import { assertTenantId } from "@/lib/db/tenant";
import { assertGenerationAllowed } from "@/lib/caps";
import { getBoss, QUEUES } from "@/lib/jobs/boss";

/**
 * Enqueues a generation for the session's tenant and returns the job row id
 * the UI polls (Day 3 progress screen, PNG 10).
 */
export async function enqueueGeneration(
  tenantId: string,
  prompt: string,
  brief?: Brief | null,
  client?: ItineraryClient | null,
) {
  const id = assertTenantId(tenantId);
  await assertGenerationAllowed(db, id); // throws CapExceededError
  const [job] = await db
    .insert(schema.generationJobs)
    .values({
      tenantId: id,
      prompt,
      brief: brief ?? null,
      client: client ?? null,
      status: "queued",
    })
    .returning();
  if (!job) throw new Error("could not create generation job");
  const boss = await getBoss();
  await boss.send(
    QUEUES.generate,
    { jobId: job.id, tenantId: id },
    { retryLimit: 1, expireInSeconds: 300 },
  );
  return job;
}

/** Progress for the polling UI — scoped by tenant so a job id alone is not enough. */
export async function getGenerationJob(tenantId: string, jobId: string) {
  const id = assertTenantId(tenantId);
  return db.query.generationJobs.findFirst({
    where: and(eq(schema.generationJobs.id, jobId), eq(schema.generationJobs.tenantId, id)),
  });
}

/** Regenerate one day of a tenant's itinerary (Day 3 brief item 4). */
export async function enqueueRegenerateDay(
  tenantId: string,
  itineraryId: string,
  dayId: string,
  label: string,
) {
  const id = assertTenantId(tenantId);
  await assertGenerationAllowed(db, id); // throws CapExceededError
  const [job] = await db
    .insert(schema.generationJobs)
    .values({
      tenantId: id,
      kind: "day",
      itineraryId,
      dayId,
      prompt: label,
      status: "queued",
    })
    .returning();
  if (!job) throw new Error("could not create regenerate job");
  const boss = await getBoss();
  await boss.send(
    QUEUES.regenerateDay,
    { jobId: job.id, tenantId: id },
    { retryLimit: 1, expireInSeconds: 180 },
  );
  return job;
}
