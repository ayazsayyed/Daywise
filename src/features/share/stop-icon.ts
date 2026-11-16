/**
 * Which line icon a stop (or a day's transport line) shows on the client page
 * and in the PDF. The stop kind sets the default; the title refines it, since
 * a flight, an airport drop and a shikara ride are all "transfer" or
 * "activity", and a hotel check-in is usually a "note". Pure, so the page,
 * the PDF and the tests agree.
 */
export type StopIcon =
  | "flight"
  | "train"
  | "boat"
  | "car"
  | "hotel"
  | "meal"
  | "sight"
  | "activity"
  | "walk"
  | "nature"
  | "shopping"
  | "leisure"
  | "note";

const RULES: [RegExp, StopIcon][] = [
  [/\b(flight|fly|flies|airport|airline|domestic terminal)\b/i, "flight"],
  [/\b(train|rail|railway|station)\b/i, "train"],
  [/\b(cruise|boat|ferry|shikara|houseboat ride|kayak|rafting|yacht|catamaran)\b/i, "boat"],
  [
    /\b(breakfast|lunch|dinner|meal|brunch|tea|café|cafe|restaurant|food|cuisine|tasting)\b/i,
    "meal",
  ],
  [/\b(check[ -]?in|check[ -]?out|hotel|resort|houseboat|stay|camp|homestay)\b/i, "hotel"],
  [/\b(market|bazaar|bazar|shopping|souk|mall)\b/i, "shopping"],
  [/\b(walk|walking|stroll|hike|hiking|trek|trekking)\b/i, "walk"],
  [/\b(leisure|free time|relax|rest|at your own pace|spa)\b/i, "leisure"],
  [
    /\b(park|garden|gardens|bagh|valley|meadow|meadows|lake|beach|waterfall|forest|glacier)\b/i,
    "nature",
  ],
];

const BY_KIND: Record<string, StopIcon> = {
  transfer: "car",
  meal: "meal",
  sight: "sight",
  activity: "activity",
  note: "note",
};

export function stopIcon(kind: string | null | undefined, title: string): StopIcon {
  // A transfer's mode comes from its title (flight / train / boat), never "hotel" or "meal".
  if (kind === "transfer") {
    for (const [re, icon] of RULES.slice(0, 3)) if (re.test(title)) return icon;
    return "car";
  }
  if (kind === "meal") return "meal";
  for (const [re, icon] of RULES) if (re.test(title)) return icon;
  return BY_KIND[kind ?? ""] ?? "note";
}

/** The day's transport line: flight, train or boat when the text says so, else a car. */
export function transportIcon(text: string): StopIcon {
  return stopIcon("transfer", text);
}
