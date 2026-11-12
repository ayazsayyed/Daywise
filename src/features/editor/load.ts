import "server-only";

import { parseStoredBrief } from "@/lib/ai/schemas";
import type { ImageRef } from "@/lib/db/schema";
import type { ItineraryTree } from "@/lib/db/itinerary";
import { imageCredit, imageUrl } from "@/lib/images/resolve";
import type { EditorDoc, EditorImage, EditorStop } from "@/lib/itinerary/doc";
import { EMPTY_PRICING, pricingSchema } from "@/lib/itinerary/pricing";

/** ImageRef → what the client renders: a URL plus the credit line (Google attribution). */
export function toEditorImage(ref: ImageRef | null | undefined, width = 1200): EditorImage | null {
  if (!ref) return null;
  return { ...ref, url: imageUrl(ref, width), credit: imageCredit(ref) };
}

/** DB tree → editor document. Pax falls back to the brief when no client is set yet. */
export function toEditorDoc(tree: ItineraryTree): EditorDoc {
  const brief = parseStoredBrief(tree.brief);
  const raw = (tree.brief ?? {}) as Record<string, unknown>;
  const pricing = pricingSchema.safeParse({ ...EMPTY_PRICING, ...(tree.pricing ?? {}) });
  const pax = tree.client?.pax ?? brief?.pax ?? { adults: 2, children: 0, child_ages: [] };
  return {
    id: tree.id,
    title: tree.title,
    status: tree.status,
    isTemplate: tree.isTemplate,
    startDate: tree.startDate,
    endDate: tree.endDate,
    destination: brief?.destination ?? String(raw.destination ?? ""),
    country: brief?.country ?? String(raw.country ?? ""),
    budget: brief?.budget ?? null,
    pace: brief?.pace ?? null,
    client: tree.client ? { ...tree.client, pax } : { name: "", pax },
    pricing: pricing.success ? pricing.data : EMPTY_PRICING,
    sections: tree.sections ?? {
      inclusions: "",
      exclusions: "",
      payment_terms: "",
      cancellation: "",
    },
    days: tree.days.map((d) => ({
      id: d.id,
      date: d.date,
      city: d.city ?? "",
      title: d.title,
      summary: d.summary ?? "",
      transport: d.transport ?? "",
      hero: toEditorImage(d.heroImage),
      stops: d.stops.map((s): EditorStop => ({
        id: s.id,
        kind: s.kind,
        title: s.title,
        description: s.description ?? "",
        time: s.time,
        duration: s.duration,
        placeId: s.placeId,
        verified: s.verified,
        image: toEditorImage(s.image, 400),
      })),
      hotel: d.hotel
        ? {
            id: d.hotel.id,
            name: d.hotel.name,
            city: d.hotel.city,
            address: d.hotel.address,
            placeId: d.hotel.placeId,
            verified: d.hotel.verified,
            manual: d.hotel.manual,
            roomType: d.hotel.roomType ?? "",
            mealPlan: d.hotel.mealPlan,
            checkIn: d.hotel.checkIn,
            checkOut: d.hotel.checkOut,
            image: toEditorImage(d.hotel.image, 800),
          }
        : null,
    })),
  };
}
