import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

import { mockItinerary } from "./mock";
import { systemPrompt } from "./prompts";
import { callStructured, type CallOptions } from "./providers";
import {
  attachDates,
  briefDates,
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

function briefToPrompt(brief: Brief, learnings?: Learnings): string {
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
  return lines.join("\n");
}

/**
 * Brief → dated itinerary. The model never sets dates; they come from the
 * brief. Validation enforces day count, hotel-per-night and the money rule;
 * on failure the issues are fed back once, then a user-readable error.
 */
export async function generate(
  brief: Brief,
  learnings?: Learnings,
  opts: CallOptions = {},
): Promise<DatedItinerary> {
  const schema = itinerarySchemaFor(brief);

  if (env.MOCK_AI === "1") {
    return attachDates(schema.parse(mockItinerary(brief)), brief);
  }

  const base = briefToPrompt(brief, learnings);
  let feedback = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await callStructured(
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
      opts,
    );
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
