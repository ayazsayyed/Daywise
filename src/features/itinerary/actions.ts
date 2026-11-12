"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { BriefError, enhance } from "@/lib/ai/enhance";
import { AIUnavailableError } from "@/lib/ai/providers";
import { briefSchema, type Brief } from "@/lib/ai/schemas";
import { recordAiUsage } from "@/lib/ai/usage";
import { requireTenant } from "@/lib/auth/guards";
import { tenantScope } from "@/lib/db/tenant";
import { logger } from "@/lib/logger";

import { enqueueGeneration, getGenerationJob } from "./jobs";

export type EnhanceResult = { ok: true; brief: Brief } | { ok: false; error: string };

/** Step 1 → 2: prompt → brief (assumed fields flagged). */
export async function enhanceRequest(prompt: string): Promise<EnhanceResult> {
  const session = await requireTenant();
  const clean = z.string().trim().max(1_000).safeParse(prompt);
  if (!clean.success || clean.data.length < 4)
    return { ok: false, error: "Describe the trip in a few words first." };
  try {
    const brief = await enhance(clean.data, { onUsage: recordAiUsage(session.tenant.id) });
    return { ok: true, brief };
  } catch (err) {
    if (err instanceof BriefError || err instanceof AIUnavailableError)
      return { ok: false, error: err.message };
    logger.error({ err }, "enhance failed");
    return { ok: false, error: "We could not read that request. Please try again." };
  }
}

const startSchema = z.object({
  prompt: z.string().trim().min(1).max(1_000),
  brief: briefSchema,
  clientName: z.string().trim().max(120),
});

/** Step 2 → 3: queue the generation and open the progress screen. */
export async function startGeneration(input: {
  prompt: string;
  brief: Brief;
  clientName: string;
}): Promise<{ error: string } | never> {
  const session = await requireTenant();
  const parsed = startSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      error: `Check ${String(issue?.path.slice(1).join(" ") || "the brief")}: ${issue?.message ?? "invalid value"}`,
    };
  }
  const { prompt, brief, clientName } = parsed.data;
  const client = clientName
    ? {
        name: clientName,
        pax: {
          adults: brief.pax.adults,
          children: brief.pax.children,
          child_ages: brief.pax.child_ages,
        },
      }
    : null;
  const job = await enqueueGeneration(session.tenant.id, prompt, brief, client);
  redirect(`/app/new/${job.id}`);
}

export type JobView = {
  status: string;
  error: string | null;
  itineraryId: string | null;
  progress: {
    steps: { name: string; result: string; ms: number }[];
    days?: string[];
  };
  elapsedMs: number;
};

/** Polled by the progress screen (PNG 10). Tenant-scoped: a job id alone is not enough. */
export async function getGenerationStatus(jobId: string): Promise<JobView | null> {
  const session = await requireTenant();
  if (!z.string().uuid().safeParse(jobId).success) return null;
  const job = await getGenerationJob(session.tenant.id, jobId);
  if (!job) return null;
  return {
    status: job.status,
    error: job.error,
    itineraryId: job.itineraryId,
    progress: job.progress,
    elapsedMs: Date.now() - job.createdAt.getTime(),
  };
}

/** Failed job → queue the same brief again. */
export async function retryGeneration(jobId: string) {
  const session = await requireTenant();
  const job = await getGenerationJob(session.tenant.id, jobId);
  if (!job) redirect("/app/new");
  const brief = job.brief ? briefSchema.safeParse(job.brief) : null;
  const next = await enqueueGeneration(
    session.tenant.id,
    job.prompt,
    brief?.success ? brief.data : null,
    job.client,
  );
  redirect(`/app/new/${next.id}`);
}

/** Start-from-template: copy the template into a fresh draft and open it. */
export async function startFromTemplate(templateId: string) {
  const session = await requireTenant();
  if (!z.string().uuid().safeParse(templateId).success) redirect("/app/new");
  const scope = tenantScope(session.tenant.id);
  const row = await scope.duplicate(templateId);
  await scope.audit("itinerary.from_template", {
    userId: session.user.id,
    entity: "itinerary",
    entityId: row.id,
    meta: { templateId },
  });
  redirect(`/app/i/${row.id}`);
}
