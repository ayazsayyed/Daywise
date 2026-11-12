import { z } from "zod";

/**
 * AI output is untrusted. Everything the model returns is parsed with these
 * schemas: strict objects (no extra keys, so no price/rating fields can sneak
 * in), enumerated meal plans, and a money check on every free-text field.
 */

/** Matches the brief form (PNG 09): Budget / Mid-range / Premium / Luxury. */
export const BUDGET_TIERS = ["budget", "mid-range", "premium", "luxury"] as const;
export type BudgetTier = (typeof BUDGET_TIERS)[number];
export const PACES = ["relaxed", "balanced", "packed"] as const;
export const MEAL_PLANS = ["EP", "CP", "MAP", "AP"] as const;
export const STOP_KINDS = ["sight", "activity", "meal", "transfer", "note"] as const;

/** ₹1,200 · INR 1200 · Rs. 500 · $40 · 1,200/- · "per night 3500" */
const MONEY =
  /(₹|\bINR\b|\bRs\.?|\$|€|£|\bUSD\b|\bAED\b)\s?\d|\d[\d,]*\s?\/-|\b\d[\d,]{2,}\s?(per|a)\s+(night|person|head|pax|day)\b/i;
/** 4.5★ · 4.5 stars · 5-star · rated 4.3 */
const RATING = /\b\d(\.\d)?\s?(★|stars?\b|-star\b)|\brated\s+\d(\.\d)?/i;

export function mentionsMoneyOrRating(text: string): boolean {
  return MONEY.test(text) || RATING.test(text);
}

const cleanText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine((t) => !mentionsMoneyOrRating(t), {
      message: "AI text must not contain prices, availability or star ratings",
    });

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

// ── Brief ────────────────────────────────────────────────────────────────
export const paxSchema = z
  .object({
    adults: z.number().int().min(1).max(40),
    children: z.number().int().min(0).max(20),
    child_ages: z.array(z.number().int().min(0).max(17)).max(20),
  })
  .strict();

export const briefSchema = z
  .object({
    /** Headline destination, e.g. "Kashmir", "Dubai", "Europe". */
    destination: z.string().trim().min(2).max(80),
    /** Cities in visiting order, e.g. ["Srinagar", "Gulmarg", "Pahalgam"]. */
    cities: z.array(z.string().trim().min(2).max(60)).min(1).max(12),
    country: z.string().trim().min(2).max(60),
    nights: z.number().int().min(1).max(30),
    start_date: isoDate.nullable(),
    pax: paxSchema,
    budget: z.enum(BUDGET_TIERS),
    pace: z.enum(PACES),
    /** Free text, e.g. "spring, pleasant days and cold nights". */
    season: z.string().trim().max(120).nullable(),
    entry_city: z.string().trim().max(60).nullable(),
    exit_city: z.string().trim().max(60).nullable(),
    must_sees: z.array(z.string().trim().min(2).max(80)).max(20),
    notes: z.string().trim().max(600).nullable(),
    currency: z.literal("INR"),
    /** Field names the enhancer guessed rather than read from the prompt. */
    assumed: z.array(z.string().trim().min(1).max(40)).max(20),
  })
  .strict();

export type Brief = z.infer<typeof briefSchema>;

/** Dates derived from the brief: day N is start_date + (N-1). */
export function briefDates(brief: Pick<Brief, "start_date" | "nights">): string[] | null {
  if (!brief.start_date) return null;
  const start = new Date(`${brief.start_date}T00:00:00Z`);
  if (Number.isNaN(start.getTime())) return null;
  return Array.from({ length: brief.nights + 1 }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

// ── Itinerary (model output) ─────────────────────────────────────────────
export const stopSchema = z
  .object({
    kind: z.enum(STOP_KINDS),
    title: cleanText(120).refine((t) => t.length >= 2),
    description: cleanText(600),
    /** "09:00" style start time, or null when flexible. */
    time: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .nullable(),
    /** "2 h", "45 min" — free text, short. */
    duration: cleanText(30).nullable(),
    /** Exact text to look the place up with: "<place name>, <city>". Null for notes/transfers. */
    place_query: z.string().trim().min(3).max(140).nullable(),
  })
  .strict();

export const hotelSchema = z
  .object({
    name: cleanText(120).refine((t) => t.length >= 2),
    city: z.string().trim().min(2).max(60),
    room_type: cleanText(60),
    meal_plan: z.enum(MEAL_PLANS),
    check_in: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .nullable(),
    check_out: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .nullable(),
    /** "<hotel name>, <city>" for Places verification. */
    place_query: z.string().trim().min(3).max(140),
  })
  .strict();

export const daySchema = z
  .object({
    day_number: z.number().int().min(1).max(31),
    title: cleanText(80).refine((t) => t.length >= 2),
    city: z.string().trim().min(2).max(60),
    summary: cleanText(400),
    /** One line: "Private car Srinagar → Gulmarg, about 2 h". */
    transport: cleanText(200),
    /** At least one stop per day; the departure day may be empty (checked in itinerarySchemaFor). */
    stops: z.array(stopSchema).max(10),
    /** The hotel for this night. Null only on the final (departure) day. */
    hotel: hotelSchema.nullable(),
  })
  .strict();

export const itineraryDraftSchema = z
  .object({
    title: cleanText(80).refine((t) => t.length >= 4),
    summary: cleanText(500),
    days: z.array(daySchema).min(1).max(31),
    /** Short practical notes, e.g. the weather disclaimer. No prices. */
    notes: z.array(cleanText(240)).max(8),
  })
  .strict();

export type ItineraryDraft = z.infer<typeof itineraryDraftSchema>;

/**
 * Full validation against the brief: day count == nights + 1, day numbers
 * sequential, a hotel on every night and none on departure day.
 */
export function itinerarySchemaFor(brief: Pick<Brief, "nights">) {
  const expected = brief.nights + 1;
  return itineraryDraftSchema.superRefine((it, ctx) => {
    if (it.days.length !== expected) {
      ctx.addIssue({
        code: "custom",
        path: ["days"],
        message: `Expected ${expected} days for ${brief.nights} nights, got ${it.days.length}`,
      });
      return;
    }
    it.days.forEach((d, i) => {
      if (d.day_number !== i + 1) {
        ctx.addIssue({
          code: "custom",
          path: ["days", i, "day_number"],
          message: `Day ${i + 1} is numbered ${d.day_number}`,
        });
      }
      const last = i === it.days.length - 1;
      if (!last && d.stops.length === 0) {
        ctx.addIssue({
          code: "custom",
          path: ["days", i, "stops"],
          message: `Day ${i + 1} needs at least one stop`,
        });
      }
      if (!last && !d.hotel) {
        ctx.addIssue({
          code: "custom",
          path: ["days", i, "hotel"],
          message: `Day ${i + 1} needs a hotel for the night`,
        });
      }
      if (last && d.hotel) {
        ctx.addIssue({
          code: "custom",
          path: ["days", i, "hotel"],
          message: "The departure day has no hotel night",
        });
      }
    });
  });
}

/** Dated itinerary: the draft plus server-computed dates (never from the model). */
export type DatedDay = ItineraryDraft["days"][number] & { date: string | null };
export type DatedItinerary = Omit<ItineraryDraft, "days"> & { days: DatedDay[] };

export function attachDates(draft: ItineraryDraft, brief: Brief): DatedItinerary {
  const dates = briefDates(brief);
  return {
    ...draft,
    days: draft.days.map((d, i) => ({ ...d, date: dates ? (dates[i] ?? null) : null })),
  };
}

/** Flattens zod issues into a short list the model can act on during the retry. */
export function describeIssues(err: z.ZodError): string {
  return err.issues
    .slice(0, 12)
    .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n");
}
