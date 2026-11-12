"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { requireTenant } from "@/lib/auth/guards";
import { InvalidEditError, NotFoundError } from "@/lib/db/itinerary";
import { tenantScope } from "@/lib/db/tenant";
import { placePhotoImage } from "@/lib/images/resolve";
import type { EditorDay, EditorImage } from "@/lib/itinerary/doc";
import { opsPayloadSchema } from "@/lib/itinerary/doc";
import { logger } from "@/lib/logger";
import { parseStoredBrief } from "@/lib/ai/schemas";
import { cachedPlace, geocodeCity, textSearch, type PlaceResult } from "@/lib/places/client";
import { cityKey, filterCandidates, hotelCandidates } from "@/lib/places/hotels";
import { enqueueRegenerateDay, getGenerationJob } from "@/features/itinerary/jobs";

import { toEditorDoc, toEditorImage } from "./load";

const uuid = z.string().uuid();

export type SaveResult =
  { ok: true; at: string } | { ok: false; code: "invalid" | "gone" | "error"; message: string };

/**
 * Autosave endpoint: a batch of editor ops for one itinerary. The tenant comes
 * from the session; every id in the batch is checked against this itinerary.
 */
export async function saveOps(itineraryId: string, ops: unknown): Promise<SaveResult> {
  const session = await requireTenant();
  if (!uuid.safeParse(itineraryId).success)
    return { ok: false, code: "gone", message: "Itinerary not found" };
  const parsed = opsPayloadSchema.safeParse(ops);
  if (!parsed.success)
    return {
      ok: false,
      code: "invalid",
      message: parsed.error.issues[0]?.message ?? "Invalid edit",
    };
  try {
    const { updatedAt } = await tenantScope(session.tenant.id).applyOps(
      itineraryId,
      parsed.data,
      async (placeId) => {
        const place = await cachedPlace(placeId);
        if (!place) return null;
        return { name: place.name, address: place.address, image: placePhotoImage(place) };
      },
    );
    return { ok: true, at: updatedAt.toISOString() };
  } catch (err) {
    if (err instanceof NotFoundError) return { ok: false, code: "gone", message: err.message };
    if (err instanceof InvalidEditError)
      return { ok: false, code: "invalid", message: err.message };
    logger.error({ err, itineraryId }, "saveOps failed");
    return { ok: false, code: "error", message: "Could not save. Check your connection." };
  }
}

export type HotelResult = {
  placeId: string;
  name: string;
  address: string | null;
  image: EditorImage | null;
};

/** Swap search (PNG 12/13): Places Text Search, lodging only, 5 results. No rating (deviation 1). */
export async function searchHotels(
  itineraryId: string,
  query: string,
  city: string,
): Promise<{ results: HotelResult[]; error?: string }> {
  const session = await requireTenant();
  const scope = tenantScope(session.tenant.id);
  const q = z.string().trim().min(2).max(120).safeParse(query);
  if (!q.success || !uuid.safeParse(itineraryId).success) return { results: [] };
  const tree = await scope.getItineraryTree(itineraryId).catch(() => null);
  if (!tree) return { results: [], error: "Itinerary not found" };
  const country = String((tree.brief as { country?: string } | null)?.country ?? "");
  const cleanCity = city.trim().slice(0, 60);
  const toResult = (p: PlaceResult): HotelResult => ({
    placeId: p.id,
    name: p.name,
    address: p.address,
    image: toEditorImage(placePhotoImage(p), 200),
  });

  // #13: the same cached lodging candidates the draft was grounded in answer instantly.
  const brief = parseStoredBrief(tree.brief);
  if (brief && cleanCity) {
    const lists = await hotelCandidates(
      [cleanCity],
      country,
      brief.budget,
      session.tenant.id,
    ).catch(() => null);
    const hits = filterCandidates(
      q.data.toLowerCase().replace(cleanCity.toLowerCase(), ""),
      lists?.[cityKey(cleanCity)] ?? [],
    );
    if (hits.length) return { results: hits.slice(0, 5).map((c) => toResult(c.place)) };
  }

  const text =
    cleanCity && !q.data.toLowerCase().includes(cleanCity.toLowerCase())
      ? `${q.data}, ${cleanCity}`
      : q.data;
  const bias = cleanCity
    ? await geocodeCity(cleanCity, country, session.tenant.id).catch(() => null)
    : null;
  const res = await textSearch(text, {
    tenantId: session.tenant.id,
    max: 5,
    includedType: "lodging",
    bias: bias ?? undefined,
  });
  if (res.budgetExhausted)
    return { results: [], error: "Hotel search is paused this month. Enter the hotel manually." };
  if (res.failed)
    return {
      results: [],
      error: "Hotel search is unavailable right now. Try again or enter the hotel manually.",
    };
  return {
    results: res.places.slice(0, 5).map(toResult),
  };
}

/** Regenerate this day: queue the job; the editor polls `getDayJob`. */
export async function regenerateDay(
  itineraryId: string,
  dayId: string,
): Promise<{ jobId: string } | { error: string }> {
  const session = await requireTenant();
  if (!uuid.safeParse(itineraryId).success || !uuid.safeParse(dayId).success)
    return { error: "Day not found" };
  const tree = await tenantScope(session.tenant.id)
    .getItineraryTree(itineraryId)
    .catch(() => null);
  const idx = tree?.days.findIndex((d) => d.id === dayId) ?? -1;
  if (!tree || idx < 0) return { error: "Day not found" };
  const job = await enqueueRegenerateDay(
    session.tenant.id,
    tree.id,
    dayId,
    `Regenerate day ${idx + 1} of ${tree.title}`,
  );
  return { jobId: job.id };
}

export type DayJobView =
  | { status: "running"; step: string }
  | { status: "failed"; error: string }
  | { status: "done"; day: EditorDay };

export async function getDayJob(jobId: string): Promise<DayJobView> {
  const session = await requireTenant();
  if (!uuid.safeParse(jobId).success) return { status: "failed", error: "Unknown job" };
  const job = await getGenerationJob(session.tenant.id, jobId);
  if (!job || job.kind !== "day" || !job.itineraryId)
    return { status: "failed", error: "Unknown job" };
  if (job.status === "failed")
    return { status: "failed", error: job.error ?? "Could not regenerate this day." };
  if (job.status !== "done") return { status: "running", step: job.status };
  const tree = await tenantScope(session.tenant.id).getItineraryTree(job.itineraryId);
  const day = toEditorDoc(tree).days.find((d) => d.id === job.dayId);
  if (!day) return { status: "failed", error: "That day was removed." };
  return { status: "done", day };
}

export async function duplicateItinerary(itineraryId: string) {
  const session = await requireTenant();
  if (!uuid.safeParse(itineraryId).success) redirect("/app");
  const scope = tenantScope(session.tenant.id);
  const row = await scope.duplicate(itineraryId);
  await scope.audit("itinerary.duplicate", {
    userId: session.user.id,
    entity: "itinerary",
    entityId: row.id,
    meta: { from: itineraryId },
  });
  redirect(`/app/i/${row.id}`);
}

export async function saveAsTemplate(itineraryId: string) {
  const session = await requireTenant();
  if (!uuid.safeParse(itineraryId).success) redirect("/app");
  const scope = tenantScope(session.tenant.id);
  const row = await scope.duplicate(itineraryId, { template: true });
  await scope.audit("itinerary.template", {
    userId: session.user.id,
    entity: "itinerary",
    entityId: row.id,
    meta: { from: itineraryId },
  });
  redirect(`/app/i/${row.id}`);
}

export async function deleteItinerary(itineraryId: string) {
  const session = await requireTenant();
  if (!uuid.safeParse(itineraryId).success) redirect("/app");
  const scope = tenantScope(session.tenant.id);
  await scope.softDelete(itineraryId).catch(() => undefined);
  await scope.audit("itinerary.delete", {
    userId: session.user.id,
    entity: "itinerary",
    entityId: itineraryId,
  });
  redirect("/app?deleted=1");
}
