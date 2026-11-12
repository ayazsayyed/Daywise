import type { Brief } from "./schemas";

/**
 * The brief form (PNG 09) highlights `assumed` fields in amber. False positives
 * teach agents to ignore the highlight, so after the model answers we drop
 * anything the prompt plainly states, plus fields that are never a guess, and
 * add the core fields (nights, pax, budget, pace, start date) it plainly does
 * not state. Conservative: when in doubt the field stays assumed.
 */
const BRIEF_FIELDS = new Set([
  "destination",
  "cities",
  "country",
  "nights",
  "start_date",
  "pax",
  "budget",
  "pace",
  "season",
  "entry_city",
  "exit_city",
  "must_sees",
]);

/** "5-day", "5 days", "5D4N", "4 nights", "5 din", "4 raat", "a week", "weekend". */
const NIGHTS =
  /\b\d{1,2}\s*-?\s*(d|days?|din|n|nights?|raat)\b|\b\d{1,2}d\s*\/?\s*\d{1,2}n\b|\b(a|one|1)\s+week\b|\bweekend\b/i;
/** "couple", "honeymoon", "solo", "2 adults", "4 pax", "6 people", "family of 4 with kids aged 6 and 9". */
const PAX =
  /\b(couple|honeymoon|honeymooners|solo)\b|\b\d{1,2}\s*(adults?|pax|people|persons|travell?ers|log|guests)\b|\bfamily of \d{1,2}\b.*\b(aged?|ages|years?|yrs?)\b/i;
const BUDGET =
  /\b(budget|sasta|economy|cheap|mid|mid-range|midrange|standard|premium|upper[- ]mid|luxury|lavish|[345][- ]?star)\b/i;
const PACE =
  /\b(relaxed|relax|chill|aaram|leisurely|slow|packed|fast|cover everything|balanced|easy pace)\b/i;

/** Month names, dates, festivals, "next week" — anything that pins the start date. */
const DATES =
  /\b(jan(uary)?|feb(ruary)?|mar(ch)?|apr(il)?|may|june?|july?|aug(ust)?|sep(t|tember)?|oct(ober)?|nov(ember)?|dec(ember)?)\b|\b\d{1,2}(st|nd|rd|th)\b|\d{4}-\d{2}-\d{2}|\b\d{1,2}[/.-]\d{1,2}\b|\b(next|this) (week|month|weekend)\b|\b(christmas|diwali|holi|eid|new year|summer|winter) (break|holidays?|vacation|week)\b|\b(christmas|diwali|holi|new year)\b/i;

export function reconcileAssumed(prompt: string, brief: Brief): string[] {
  const p = prompt.toLowerCase();
  const destinationStated = p.includes(brief.destination.toLowerCase());
  const stated: Record<string, boolean> = {
    nights: NIGHTS.test(p),
    pax: PAX.test(p),
    budget: BUDGET.test(p),
    pace: PACE.test(p),
    destination: destinationStated,
    country: destinationStated || p.includes(brief.country.toLowerCase()),
  };

  const out: string[] = [];
  // The model under-reports too: core fields the prompt plainly does not state are assumed.
  const core: [string, boolean][] = [
    ["nights", stated.nights!],
    ["pax", stated.pax!],
    ["budget", stated.budget!],
    ["pace", stated.pace!],
    ["start_date", DATES.test(p)],
  ];
  const listed = brief.assumed.map((a) => a.trim().split(/[.[]/)[0]!);
  for (const [field, isStated] of core) {
    if (!isStated && !listed.includes(field)) out.push(field);
  }
  for (const raw of brief.assumed) {
    // "pax.adults" → "pax"; ignore unknown names and fixed values (currency, notes).
    const field = raw.trim().split(/[.[]/)[0]!;
    if (!BRIEF_FIELDS.has(field)) continue;
    if (stated[field]) continue;
    if (!out.includes(field)) out.push(field);
  }
  return out;
}
