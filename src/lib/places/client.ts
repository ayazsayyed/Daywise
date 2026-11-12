import { eq, gt } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

import { placesBudget } from "./budget";

/**
 * Google Places (New) Text Search with the exact, locked field mask. Never
 * request rating/reviews — it re-prices the call. Results are cached for 30
 * days by normalised query; place payloads are cached by place_id so the photo
 * proxy can attach author attribution without another call.
 */
export const PLACES_FIELD_MASK =
  "places.id,places.displayName,places.formattedAddress,places.location,places.photos";

export const PLACES_CACHE_DAYS = 30;
const CACHE_MS = PLACES_CACHE_DAYS * 24 * 60 * 60 * 1000;
const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";

export type PlacePhoto = {
  /** Resource name `places/{id}/photos/{ref}` — the only thing we store. */
  name: string;
  widthPx?: number;
  heightPx?: number;
  attribution: string | null;
  attributionUrl: string | null;
};

export type PlaceResult = {
  id: string;
  name: string;
  address: string | null;
  location: { lat: number; lng: number } | null;
  photos: PlacePhoto[];
};

export type LocationBias = { lat: number; lng: number; radiusM: number };

export type TextSearchResult = {
  places: PlaceResult[];
  /** True when the budget guard refused the call (nothing was searched). */
  budgetExhausted: boolean;
  fromCache: boolean;
  /** Places could not answer (no key, HTTP error, network). Distinct from budget. */
  failed?: "no_key" | "http" | "network";
};

export function normaliseQuery(q: string, bias?: LocationBias, includedType?: string): string {
  let base = q.toLowerCase().replace(/\s+/g, " ").trim();
  if (includedType) base = `${base} #${includedType}`;
  if (!bias) return base;
  return `${base} @${bias.lat.toFixed(2)},${bias.lng.toFixed(2)}`;
}

type RawPlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  photos?: {
    name?: string;
    widthPx?: number;
    heightPx?: number;
    authorAttributions?: { displayName?: string; uri?: string }[];
  }[];
};

export function parsePlace(raw: RawPlace): PlaceResult | null {
  if (!raw.id || !raw.displayName?.text) return null;
  return {
    id: raw.id,
    name: raw.displayName.text,
    address: raw.formattedAddress ?? null,
    location:
      raw.location?.latitude !== undefined && raw.location?.longitude !== undefined
        ? { lat: raw.location.latitude, lng: raw.location.longitude }
        : null,
    photos: (raw.photos ?? [])
      .filter((p): p is typeof p & { name: string } => typeof p.name === "string")
      .slice(0, 3)
      .map((p) => ({
        name: p.name,
        widthPx: p.widthPx,
        heightPx: p.heightPx,
        attribution: p.authorAttributions?.[0]?.displayName ?? null,
        attributionUrl: p.authorAttributions?.[0]?.uri ?? null,
      })),
  };
}

/** MOCK_AI places: kept in memory so `cachedPlace` can resolve what `textSearch` returned. */
const mockCache = new Map<string, PlaceResult>();

function mockPlaces(query: string, includedType?: string): PlaceResult[] {
  const name = query.split(",")[0]!.trim();
  const area = query.split(",").slice(1).join(",").trim() || "India";
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const names =
    includedType === "lodging"
      ? [
          `${name} Grand Hotel`,
          `${name} Residency`,
          `Hotel ${name} Heights`,
          `${name} Retreat`,
          `The ${name} House`,
        ]
      : [name];
  return names.map((n) => {
    const p: PlaceResult = {
      id: `mock-${slug(n)}`,
      name: n,
      address: area,
      location: { lat: 34.08, lng: 74.8 },
      photos: [],
    };
    mockCache.set(p.id, p);
    return p;
  });
}

export async function textSearch(
  query: string,
  opts: {
    bias?: LocationBias;
    tenantId?: string | null;
    max?: number;
    /** Places type filter, e.g. "lodging" for the hotel swap search. A body parameter: no re-pricing. */
    includedType?: string;
  } = {},
): Promise<TextSearchResult> {
  const key = normaliseQuery(query, opts.bias, opts.includedType);

  if (env.MOCK_AI === "1")
    return {
      places: mockPlaces(query, opts.includedType).slice(0, opts.max ?? 5),
      budgetExhausted: false,
      fromCache: false,
    };

  const cached = await db.query.placesQueries.findFirst({
    where: eq(schema.placesQueries.query, key),
  });
  if (cached && cached.fetchedAt.getTime() > Date.now() - CACHE_MS) {
    const places = (cached.payload as RawPlace[])
      .map(parsePlace)
      .filter((p): p is PlaceResult => !!p);
    return { places, budgetExhausted: false, fromCache: true };
  }

  if (!env.GOOGLE_PLACES_API_KEY) {
    logger.warn("GOOGLE_PLACES_API_KEY missing; skipping verification");
    return { places: [], budgetExhausted: false, fromCache: false, failed: "no_key" };
  }

  const allowed = await placesBudget().spend("places_search", opts.tenantId ?? null);
  if (!allowed) return { places: [], budgetExhausted: true, fromCache: false };

  const body: Record<string, unknown> = {
    textQuery: query,
    pageSize: Math.min(opts.max ?? 5, 20),
    languageCode: "en",
  };
  if (opts.includedType) body.includedType = opts.includedType;
  if (opts.bias) {
    body.locationBias = {
      circle: {
        center: { latitude: opts.bias.lat, longitude: opts.bias.lng },
        radius: Math.min(opts.bias.radiusM, 50_000),
      },
    };
  }

  let raw: RawPlace[] = [];
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": env.GOOGLE_PLACES_API_KEY,
        "X-Goog-FieldMask": PLACES_FIELD_MASK,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      logger.error(
        { status: res.status, query, text: (await res.text()).slice(0, 300) },
        "Places error",
      );
      return { places: [], budgetExhausted: false, fromCache: false, failed: "http" };
    }
    const json = (await res.json()) as { places?: RawPlace[] };
    raw = json.places ?? [];
  } catch (err) {
    logger.error({ err, query }, "Places request failed");
    return { places: [], budgetExhausted: false, fromCache: false, failed: "network" };
  }

  const places = raw.map(parsePlace).filter((p): p is PlaceResult => !!p);
  await db
    .insert(schema.placesQueries)
    .values({ query: key, payload: raw as Record<string, unknown>[], fetchedAt: new Date() })
    .onConflictDoUpdate({
      target: schema.placesQueries.query,
      set: { payload: raw as Record<string, unknown>[], fetchedAt: new Date() },
    });
  for (const p of raw) {
    if (!p.id) continue;
    await db
      .insert(schema.placesCache)
      .values({ placeId: p.id, payload: p as Record<string, unknown>, fetchedAt: new Date() })
      .onConflictDoUpdate({
        target: schema.placesCache.placeId,
        set: { payload: p as Record<string, unknown>, fetchedAt: new Date() },
      });
  }
  return { places, budgetExhausted: false, fromCache: false };
}

/** Rough centre of a city for location bias; one cached Text Search per city. */
export async function geocodeCity(
  city: string,
  country: string,
  tenantId?: string | null,
): Promise<LocationBias | null> {
  const { places } = await textSearch(`${city}, ${country}`, { tenantId, max: 1 });
  const loc = places[0]?.location;
  return loc ? { lat: loc.lat, lng: loc.lng, radiusM: 30_000 } : null;
}

/** Cached place payload by id (for the photo proxy's attribution header). */
export async function cachedPlace(placeId: string): Promise<PlaceResult | null> {
  if (env.MOCK_AI === "1") return mockCache.get(placeId) ?? null;
  const row = await db.query.placesCache.findFirst({
    where: eq(schema.placesCache.placeId, placeId),
  });
  return row ? parsePlace(row.payload as RawPlace) : null;
}

/** Keeps `gt` referenced for callers that filter fresh rows explicitly. */
export const freshSince = () => gt(schema.placesQueries.fetchedAt, new Date(Date.now() - CACHE_MS));
