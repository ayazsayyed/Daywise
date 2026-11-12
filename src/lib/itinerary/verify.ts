import type { ImageRef } from "@/lib/db/schema";
import { mapLimit } from "@/lib/concurrency";
import { destinationImage, placeholderImage, placePhotoImage } from "@/lib/images/resolve";
import { geocodeCity, textSearch, type LocationBias, type PlaceResult } from "@/lib/places/client";
import { findCandidate, type HotelCandidates } from "@/lib/places/hotels";
import { nameMatches } from "@/lib/places/match";

import type { Brief, DatedItinerary } from "@/lib/ai/schemas";

/**
 * Verify step: every hotel and stop with a `place_query` goes through Places
 * Text Search ("<name>, <city>", biased to the city). A match sets place_id,
 * verified and the photo; a miss keeps the item and flags it. Concurrency 5.
 */
export type VerifiedStop = DatedItinerary["days"][number]["stops"][number] & {
  place_id: string | null;
  verified: boolean;
  address: string | null;
  image: ImageRef;
};

export type VerifiedHotel = NonNullable<DatedItinerary["days"][number]["hotel"]> & {
  place_id: string | null;
  verified: boolean;
  address: string | null;
  image: ImageRef;
};

export type VerifiedDay = Omit<DatedItinerary["days"][number], "stops" | "hotel"> & {
  stops: VerifiedStop[];
  hotel: VerifiedHotel | null;
  hero_image: ImageRef;
};

export type VerificationStats = {
  hotels: number;
  hotels_total: number;
  stops: number;
  stops_total: number;
  budget_exhausted: boolean;
  places_calls: number;
  /** Searches Places could not answer (no key, key restriction, network). */
  places_failed: number;
  /** Hotels picked from the grounded candidate list (#13): verified without another call. */
  hotels_from_list: number;
  /** Hotels the model chose off the candidate list; verified only if Places matches them. */
  hotels_off_list: number;
};

export type VerifiedItinerary = Omit<DatedItinerary, "days"> & {
  days: VerifiedDay[];
  stats: VerificationStats;
};

export { nameMatches };

export async function verifyItinerary(
  it: DatedItinerary,
  brief: Brief,
  tenantId: string | null,
  themeColor?: string,
  opts: { hotels?: HotelCandidates } = {},
): Promise<VerifiedItinerary> {
  const stats: VerificationStats = {
    hotels: 0,
    hotels_total: 0,
    stops: 0,
    stops_total: 0,
    budget_exhausted: false,
    places_calls: 0,
    places_failed: 0,
    hotels_from_list: 0,
    hotels_off_list: 0,
  };

  // One bias per city, fetched up front (cached in places_queries).
  const cities = [...new Set(it.days.map((d) => d.city))];
  const bias = new Map<string, LocationBias | null>();
  await mapLimit(cities, 5, async (city) => {
    bias.set(city, await geocodeCity(city, brief.country, tenantId).catch(() => null));
  });

  type Task = { dayIdx: number; kind: "stop" | "hotel"; idx: number; query: string; city: string };
  const tasks: Task[] = [];
  it.days.forEach((d, dayIdx) => {
    d.stops.forEach((s, idx) => {
      if (s.place_query)
        tasks.push({ dayIdx, kind: "stop", idx, query: s.place_query, city: d.city });
    });
    if (d.hotel)
      tasks.push({ dayIdx, kind: "hotel", idx: 0, query: d.hotel.place_query, city: d.city });
  });

  const results = new Map<string, PlaceResult | null>();
  const hasCandidates = !!opts.hotels && Object.values(opts.hotels).some((l) => l.length);
  await mapLimit(tasks, 5, async (t) => {
    if (t.kind === "hotel" && hasCandidates) {
      const name = it.days[t.dayIdx]!.hotel!.name;
      const picked = findCandidate(name, t.city, opts.hotels);
      if (picked) {
        stats.hotels_from_list++;
        results.set(`${t.dayIdx}:${t.kind}:${t.idx}`, picked.place);
        return;
      }
      stats.hotels_off_list++;
    }
    const res = await textSearch(t.query, {
      bias: bias.get(t.city) ?? undefined,
      tenantId,
      max: 3,
    });
    if (!res.fromCache) stats.places_calls++;
    if (res.budgetExhausted) stats.budget_exhausted = true;
    if (res.failed) stats.places_failed++;
    const match = res.places.find((p) => nameMatches(t.query, p.name)) ?? null;
    results.set(`${t.dayIdx}:${t.kind}:${t.idx}`, match);
  });

  let imgIndex = 0;
  const days: VerifiedDay[] = [];
  for (const [dayIdx, d] of it.days.entries()) {
    const stops: VerifiedStop[] = d.stops.map((s, idx) => {
      const match = s.place_query ? (results.get(`${dayIdx}:stop:${idx}`) ?? null) : null;
      if (s.place_query) stats.stops_total++;
      if (match) stats.stops++;
      return {
        ...s,
        place_id: match?.id ?? null,
        verified: !!match,
        address: match?.address ?? null,
        image:
          (match && placePhotoImage(match)) ?? placeholderImage(s.title, imgIndex++, themeColor),
      };
    });

    let hotel: VerifiedHotel | null = null;
    if (d.hotel) {
      stats.hotels_total++;
      const match = results.get(`${dayIdx}:hotel:0`) ?? null;
      if (match) stats.hotels++;
      hotel = {
        ...d.hotel,
        place_id: match?.id ?? null,
        verified: !!match,
        address: match?.address ?? null,
        image:
          (match && placePhotoImage(match)) ??
          placeholderImage(d.hotel.name, imgIndex++, themeColor),
      };
    }

    const firstPlacePhoto = stops.find((s) => s.image.source === "place")?.image;
    const hero: ImageRef =
      firstPlacePhoto ??
      (await destinationImage(`${d.city} ${brief.country} landscape`).catch(() => null)) ??
      (await destinationImage(`${brief.destination} landscape`).catch(() => null)) ??
      placeholderImage(d.city, dayIdx, themeColor);

    days.push({ ...d, stops, hotel, hero_image: hero });
  }

  return { ...it, days, stats };
}
