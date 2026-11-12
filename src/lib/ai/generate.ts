import { env } from "@/lib/env";
import { hotelCandidatesPrompt, type HotelCandidates } from "@/lib/places/hotels";
import { logger } from "@/lib/logger";

import { mockDay, mockItinerary } from "./mock";
import { systemPrompt } from "./prompts";
import {
  callStructured,
  isSchemaRejection,
  retryChain,
  schemaRejectionFeedback,
  type CallOptions,
} from "./providers";
import {
  attachDates,
  briefDates,
  daySchema,
  daySchemaFor,
  type DatedDay,
  describeIssues,
  itineraryDraftSchema,
  itinerarySchemaFor,
  type Brief,
  type DatedItinerary,
} from "./schemas";

export class GenerationError extends Error {
  constructor(
    message: string,
    public issues?: string,
  ) {
    super(message);
    this.name = "GenerationError";
  }
}

export type Learnings = {
  /** Lines like "Prefers The Khyber over Hotel Highlands Park in Gulmarg". */
  preferences: string[];
};

/** What the draft is grounded in besides the brief: agency learnings and real hotels (#13). */
export type DraftContext = {
  learnings?: Learnings;
  hotels?: HotelCandidates;
};

export function briefToPrompt(brief: Brief, ctx: DraftContext = {}): string {
  const { learnings } = ctx;
  const dates = briefDates(brief);
  const lines = [
    `Destination: ${brief.destination} (${brief.country})`,
    `Route / cities: ${brief.cities.join(" → ")}`,
    `Nights: ${brief.nights} (so exactly ${brief.nights + 1} days)`,
    dates
      ? `Dates: ${dates[0]} to ${dates[dates.length - 1]} (day 1 = ${dates[0]})`
      : "Dates: not fixed yet",
    `Season: ${brief.season ?? "unknown — assume the typical season for these dates"}`,
    `Travellers: ${brief.pax.adults} adults` +
      (brief.pax.children
        ? `, ${brief.pax.children} children (ages ${brief.pax.child_ages.join(", ") || "unknown"})`
        : ""),
    `Budget tier: ${brief.budget}`,
    `Pace: ${brief.pace}`,
    `Entry: ${brief.entry_city ?? "unknown"} · Exit: ${brief.exit_city ?? brief.entry_city ?? "unknown"}`,
    brief.must_sees.length ? `Must include: ${brief.must_sees.join("; ")}` : null,
    brief.notes ? `Agent notes: ${brief.notes}` : null,
  ].filter(Boolean);

  if (learnings?.preferences.length) {
    lines.push(
      "",
      "Agent preferences for this destination (from their past edits; follow unless the brief conflicts):",
      ...learnings.preferences.slice(0, 12).map((p) => `- ${p}`),
    );
  }
  const hotels = hotelCandidatesPrompt(ctx.hotels);
  if (hotels) lines.push(hotels);
  return lines.join("\n");
}

/**
 * Brief → dated itinerary. The model never sets dates; they come from the
 * brief. Validation enforces day count, hotel-per-night and the money rule;
 * on failure the issues are fed back once, then a user-readable error.
 */
export async function generate(
  brief: Brief,
  ctx: DraftContext = {},
  opts: CallOptions = {},
): Promise<DatedItinerary> {
  const schema = itinerarySchemaFor(brief);

  // An injected runner (tests) bypasses the fixtures so the retry path is exercised.
  if (env.MOCK_AI === "1" && !opts.runner) {
    return attachDates(schema.parse(mockItinerary(brief)), brief);
  }

  const base = briefToPrompt(brief, ctx);
  let feedback = "";
  let callOpts = opts;
  for (let attempt = 0; attempt < 2; attempt++) {
    let res;
    try {
      res = await callStructured(
        {
          op: "generate",
          schema: itineraryDraftSchema,
          system: systemPrompt("itinerary"),
          prompt: feedback
            ? `${base}\n\nYour previous draft was rejected for these reasons:\n${feedback}\nReturn a corrected full itinerary.`
            : base,
          temperature: 0.5,
          maxOutputTokens: 12_000,
        },
        callOpts,
      );
    } catch (err) {
      // Provider-side or SDK-side schema rejection: the model answered badly. Retry once.
      if (!isSchemaRejection(err)) throw err;
      feedback = schemaRejectionFeedback(err);
      // The provider rejected its own JSON: give the one retry to the fallback model first.
      callOpts = { ...opts, chain: retryChain(opts) };
      logger.warn({ attempt, feedback }, "itinerary rejected by structured-output schema");
      continue;
    }
    const parsed = schema.safeParse(res.object);
    if (parsed.success) return attachDates(parsed.data, brief);
    feedback = describeIssues(parsed.error);
    logger.warn({ attempt, feedback }, "itinerary failed validation");
  }
  throw new GenerationError(
    "The draft did not pass our checks (day count, dates or content rules). Please try again or adjust the brief.",
    feedback,
  );
}

export type DayContext = {
  day_number: number;
  date: string | null;
  city: string;
  title: string;
  stops: string[];
  hotel: string | null;
};

/**
 * Regenerate one day inside an existing itinerary. The other days are given as
 * context so the new day does not repeat them; the date comes from the
 * editor, never from the model. Same retry-once-then-readable-error rule.
 */
export async function generateDay(
  brief: Brief,
  days: DayContext[],
  dayNumber: number,
  ctx: DraftContext = {},
  opts: CallOptions = {},
): Promise<DatedDay> {
  const target = days.find((d) => d.day_number === dayNumber);
  if (!target) throw new GenerationError("That day is no longer in the itinerary.");
  const isLast = dayNumber === days.length;
  const schema = daySchemaFor(dayNumber, isLast);

  if (env.MOCK_AI === "1" && !opts.runner) {
    return { ...schema.parse(mockDay(brief, target, isLast)), date: target.date };
  }

  const base = [
    briefToPrompt({ ...brief, nights: days.length - 1 }, ctx),
    "",
    "The itinerary as it stands (the agent may have edited it):",
    ...days.map(
      (d) =>
        `Day ${d.day_number}${d.date ? ` (${d.date})` : ""} — ${d.city} — ${d.title}: ${d.stops.join("; ") || "no stops"}${d.hotel ? ` · Hotel: ${d.hotel}` : ""}`,
    ),
    "",
    `Rewrite only Day ${dayNumber} in ${target.city}. Give a clearly different plan from the current one, keep it consistent with the days before and after, and do not repeat their stops.`,
    isLast
      ? "This is the departure day: no hotel, and at least one stop (the transfer to the airport or station)."
      : `This day has a hotel for the night in ${target.city}.`,
    `Return one day object with day_number ${dayNumber}.`,
  ].join("\n");

  let feedback = "";
  let callOpts = opts;
  for (let attempt = 0; attempt < 2; attempt++) {
    let res;
    try {
      res = await callStructured(
        {
          op: "generate-day",
          schema: daySchema,
          system: systemPrompt("itinerary"),
          prompt: feedback
            ? `${base}\n\nYour previous day was rejected for these reasons:\n${feedback}\nReturn a corrected day.`
            : base,
          temperature: 0.7,
          maxOutputTokens: 4_000,
        },
        callOpts,
      );
    } catch (err) {
      if (!isSchemaRejection(err)) throw err;
      feedback = schemaRejectionFeedback(err);
      // The provider rejected its own JSON: give the one retry to the fallback model first.
      callOpts = { ...opts, chain: retryChain(opts) };
      continue;
    }
    const parsed = schema.safeParse(res.object);
    if (parsed.success) return { ...parsed.data, date: target.date };
    feedback = describeIssues(parsed.error);
    logger.warn({ attempt, feedback }, "regenerated day failed validation");
  }
  throw new GenerationError(
    "The new version of this day did not pass our checks. Please try again.",
    feedback,
  );
}
