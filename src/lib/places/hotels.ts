import type { BUDGET_TIERS } from "@/lib/ai/schemas";
import { mapLimit } from "@/lib/concurrency";

import { geocodeCity, textSearch, type PlaceResult } from "./client";
import { nameMatches } from "./match";

/**
 * Grounded hotel choice (#13). Before drafting, each city gets two cached
 * Places lodging searches ("<tier> hotels in <city>" and "hotels in <city>",
 * up to 20 each, 30-day cache in `places_queries`). The model then picks
 * hotels only from these real names, so verification matches on first pass.
 * Same locked field mask as every other Text Search.
 */
export type HotelCandidate = {
  placeId: string;
  name: string;
  /** Short locality from the address ("Dal Lake"). */
  area: string;
  place: PlaceResult;
};

/** Keyed by lower-cased city name. */
export type HotelCandidates = Record<string, HotelCandidate[]>;

export const CANDIDATES_PER_QUERY = 20;
/** Cap per city in the prompt; keeps the prompt short and the model focused. */
export const PROMPT_CANDIDATES_PER_CITY = 6;

const TIER_LABEL: Record<(typeof BUDGET_TIERS)[number], string> = {
  budget: "budget",
  "mid-range": "mid-range",
  premium: "premium",
  luxury: "luxury",
};

export const cityKey = (city: string) => city.trim().toLowerCase();

export function candidateQueries(city: string, budget: (typeof BUDGET_TIERS)[number]): string[] {
  return [`${TIER_LABEL[budget]} hotels in ${city}`, `hotels in ${city}`];
}

/** Locality from a formatted address: drops street numbers, postcodes, state and country. */
export function areaOf(address: string | null, city: string): string {
  if (!address) return city;
  const parts = address
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const c = cityKey(city);
  const cityIdx = parts.findIndex((p) => cityKey(p).includes(c));
  const before = (cityIdx > 0 ? parts.slice(0, cityIdx) : parts.slice(0, -2)).filter(
    (p) => !/^\d|\d{5,}/.test(p) && p.length <= 40,
  );
  return before.slice(-1).join(", ") || city;
}

/** Dedupe by place id, tier-specific results first (they come first in `lists`). */
export function mergeCandidates(lists: PlaceResult[][], city: string): HotelCandidate[] {
  const seen = new Set<string>();
  const out: HotelCandidate[] = [];
  for (const list of lists)
    for (const p of list) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      out.push({ placeId: p.id, name: p.name, area: areaOf(p.address, city), place: p });
    }
  return out;
}

/** The block appended to the itinerary/day prompt. Empty when Places gave nothing. */
export function hotelCandidatesPrompt(candidates: HotelCandidates | undefined): string {
  if (!candidates) return "";
  const cities = Object.entries(candidates).filter(([, list]) => list.length);
  if (!cities.length) return "";
  const lines = [
    "",
    "Hotel candidates (real properties from Google Places). Choose hotels only from the list for that city.",
    'Copy the name exactly and use "<name>, <city>" as place_query. If none fits the brief, use the closest candidate and say why in `notes`.',
  ];
  for (const [key, list] of cities) {
    lines.push(`Candidates for ${titleCase(key)}:`);
    for (const c of list.slice(0, PROMPT_CANDIDATES_PER_CITY))
      lines.push(`- ${c.name} · ${c.area}`);
  }
  return lines.join("\n");
}

const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * The candidate a drafted hotel refers to, or null when the model went off the
 * list. Looks in that city's list first; falls back to every city only when the
 * city has no list (the model may spell the city differently from the brief).
 */
export function findCandidate(
  hotelName: string,
  city: string,
  candidates: HotelCandidates | undefined,
): HotelCandidate | null {
  if (!candidates) return null;
  const own = candidates[cityKey(city)];
  const pool = own?.length ? own : Object.values(candidates).flat();
  const name = hotelName.split(",")[0]!.trim();
  return (
    pool.find((c) => c.name.toLowerCase() === name.toLowerCase()) ??
    pool.find((c) => nameMatches(name, c.name)) ??
    null
  );
}

/** Two cached lodging searches per city, biased to the city centre. */
export async function hotelCandidates(
  cities: string[],
  country: string,
  budget: (typeof BUDGET_TIERS)[number],
  tenantId: string | null,
): Promise<HotelCandidates> {
  const out: HotelCandidates = {};
  const unique = [...new Map(cities.map((c) => [cityKey(c), c.trim()])).values()].filter(Boolean);
  await mapLimit(unique, 4, async (city) => {
    const bias = await geocodeCity(city, country, tenantId).catch(() => null);
    const lists = await Promise.all(
      candidateQueries(city, budget).map((q) =>
        textSearch(q, {
          tenantId,
          max: CANDIDATES_PER_QUERY,
          includedType: "lodging",
          bias: bias ?? undefined,
        })
          .then((r) => r.places)
          .catch(() => [] as PlaceResult[]),
      ),
    );
    out[cityKey(city)] = mergeCandidates(lists, city);
  });
  return out;
}

/**
 * Swap search over the cached candidates: every query word must appear in the
 * name or area. Lets the editor answer instantly without a Places call.
 */
export function filterCandidates(query: string, list: HotelCandidate[]): HotelCandidate[] {
  const words = query
    .toLowerCase()
    .split(/[\s,]+/)
    .filter((w) => w.length >= 2 && !["hotel", "hotels", "in", "the"].includes(w));
  if (!words.length) return list;
  return list.filter((c) => {
    const hay = `${c.name} ${c.area}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}
