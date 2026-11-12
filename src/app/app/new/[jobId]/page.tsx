import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { getGenerationStatus } from "@/features/itinerary/actions";
import { GenerationProgress } from "@/features/itinerary/generation-progress";
import { getGenerationJob } from "@/features/itinerary/jobs";
import { briefSchema } from "@/lib/ai/schemas";
import { requireTenant } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Drafting itinerary" };

export default async function GenerationPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  if (!z.string().uuid().safeParse(jobId).success) notFound();
  const session = await requireTenant();
  const job = await getGenerationJob(session.tenant.id, jobId);
  if (!job) notFound();
  if (job.status === "done" && job.itineraryId) redirect(`/app/i/${job.itineraryId}`);

  const brief = job.brief ? briefSchema.safeParse(job.brief) : null;
  const initial = await getGenerationStatus(jobId);
  return (
    <GenerationProgress
      jobId={jobId}
      initial={initial!}
      clientName={job.client?.name ?? null}
      brief={
        brief?.success
          ? {
              destination: brief.data.destination,
              nights: brief.data.nights,
              adults: brief.data.pax.adults,
              children: brief.data.pax.children,
              startDate: brief.data.start_date,
            }
          : null
      }
    />
  );
}
