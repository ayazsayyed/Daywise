import { enhance } from "@/lib/ai/enhance";
import { generate } from "@/lib/ai/generate";
import { learningsFor } from "@/lib/ai/learnings";
import type { UsageReport } from "@/lib/ai/providers";
import { briefSchema, type Brief } from "@/lib/ai/schemas";
import { recordAiUsage } from "@/lib/ai/usage";
import { hotelCandidates, type HotelCandidates } from "@/lib/places/hotels";

import { verifyItinerary, type VerifiedItinerary } from "./verify";

/**
 * The whole generation pipeline, usable from the pg-boss job and the CLI:
 * enhance (if no brief) → generate (with tenant learnings) → verify + photos.
 * Persistence is the caller's job (see tenantScope.createGeneratedItinerary).
 */
export type PipelineStep = "enhancing" | "drafting" | "verifying" | "photos";

export type PipelineProgress = {
  step: PipelineStep;
  /** Set when the step finished, with a one-line result. */
  result?: string;
  ms?: number;
  days?: string[];
};

export type PipelineInput = {
  tenantId: string;
  prompt: string;
  brief?: Brief | null;
  themeColor?: string;
  onProgress?: (p: PipelineProgress) => void | Promise<void>;
  today?: Date;
};

export type PipelineOutput = {
  brief: Brief;
  itinerary: VerifiedItinerary;
  usage: UsageReport[];
  timings: Record<PipelineStep, number>;
};

export async function runPipeline(input: PipelineInput): Promise<PipelineOutput> {
  const usage: UsageReport[] = [];
  const record = recordAiUsage(input.tenantId);
  const onUsage = async (u: UsageReport) => {
    usage.push(u);
    await record(u);
  };
  const timings: Record<PipelineStep, number> = {
    enhancing: 0,
    drafting: 0,
    verifying: 0,
    photos: 0,
  };
  const tick = async (p: PipelineProgress) => input.onProgress?.(p);

  // 1. Brief
  let t = Date.now();
  await tick({ step: "enhancing" });
  const brief = input.brief
    ? briefSchema.parse(input.brief)
    : await enhance(input.prompt, { onUsage, today: input.today });
  timings.enhancing = Date.now() - t;
  await tick({
    step: "enhancing",
    ms: timings.enhancing,
    result: `${brief.destination} · ${brief.nights} nights · ${brief.pax.adults + brief.pax.children} travellers · ${brief.budget}`,
  });

  // 2. Draft
  t = Date.now();
  await tick({ step: "drafting" });
  // Learnings and grounded hotel candidates (#13) in parallel; both are cheap on a warm cache.
  const [learnings, hotels] = await Promise.all([
    learningsFor(input.tenantId, brief.destination).catch(() => undefined),
    hotelCandidates(brief.cities, brief.country, brief.budget, input.tenantId).catch(
      () => ({}) as HotelCandidates,
    ),
  ]);
  const draft = await generate(brief, { learnings, hotels }, { onUsage });
  timings.drafting = Date.now() - t;
  await tick({
    step: "drafting",
    ms: timings.drafting,
    result: `${draft.days.length} days drafted`,
    days: draft.days.map((d) => d.title),
  });

  // 3 + 4. Verify and photos (one pass; photos ride along with verification)
  t = Date.now();
  await tick({ step: "verifying" });
  const itinerary = await verifyItinerary(draft, brief, input.tenantId, input.themeColor, {
    hotels,
  });
  timings.verifying = Date.now() - t;
  const s = itinerary.stats;
  await tick({
    step: "verifying",
    ms: timings.verifying,
    result: `${s.hotels}/${s.hotels_total} hotels and ${s.stops}/${s.stops_total} stops verified${s.budget_exhausted ? " (Places budget exhausted)" : s.places_failed ? " (Places unavailable)" : ""}`,
  });
  await tick({ step: "photos" });
  const photos = itinerary.days.filter((d) => d.hero_image.source !== "placeholder").length;
  await tick({
    step: "photos",
    ms: 0,
    result: `${photos}/${itinerary.days.length} days with a photo`,
  });

  return { brief, itinerary, usage, timings };
}
