import type { TenantBranding, TenantDefaults } from "@/lib/db/schema";
import { formatClock, formatDate, formatINR } from "@/lib/format";
import type { EditorDoc, EditorImage } from "@/lib/itinerary/doc";
import { computePricing } from "@/lib/itinerary/pricing";
import { areaOf } from "@/lib/places/hotels";

import { clientAskMessage, telHref, waHref } from "./whatsapp";

/**
 * Everything the client page and the PDF render, built once from the editor
 * document (so the link always matches the editor) and the tenant. Pure: no
 * DB, no env. DESIGN.md Part 2 decides every string here.
 */

export type ShareImage = { url: string; caption: string; credit: string | null; google: boolean };

export type ShareStop = { time: string; title: string; line: string };

export type ShareHotel = {
  eyebrow: string;
  name: string;
  area: string;
  image: ShareImage | null;
  rows: { label: string; value: string }[];
};

export type ShareDay = {
  n: number;
  anchor: string;
  eyebrow: string;
  eyebrowPrint: string;
  dateShort: string;
  title: string;
  city: string;
  hero: ShareImage | null;
  transport: string;
  stops: ShareStop[];
  hotel: ShareHotel | null;
  /** Night line for the index and Overview sheet: "Night 1 · Sukoon Houseboat" or "Departure · no hotel". */
  nightLine: string;
};

export type SharePrice = {
  amount: string;
  unitLine: string;
  lines: { label: string; amount: string }[];
  total: string | null;
  totalLabel: string;
  taxNote: string;
  /** Sticky bar: "₹42,250" + "per person · 2 adults". */
  bar: { amount: string; line: string };
};

export type ContactRow = { label: string; value: string; href?: string };

export type ShareAgency = {
  name: string;
  initials: string;
  tagline: string;
  logoUrl: string | null;
  accent: string;
  footer: string;
  contactPerson: string;
  phone: string;
  phoneHref: string | null;
  whatsappHref: string | null;
  email: string;
  website: string;
  contacts: ContactRow[];
};

export type ShareView = {
  agency: ShareAgency;
  title: string;
  preparedFor: string | null;
  meta: string;
  dateRange: string | null;
  nightsLabel: string;
  summary: string;
  route: string;
  cover: ShareImage | null;
  days: ShareDay[];
  price: SharePrice | null;
  sections: { included: string[]; excluded: string[]; payment: string; cancellation: string };
  lastUpdated: string;
  printedOn: string;
  credits: string;
  /** "Kashmir for Ananya & Rohit Kapoor" — running PDF footer. */
  footerTitle: string;
  countWord: string;
};

const NO_PAX = { adults: 2, children: 0, child_ages: [] as number[] };

const MEALS: Record<string, string> = {
  EP: "Room only",
  CP: "Breakfast included",
  MAP: "Breakfast and dinner",
  AP: "All meals",
};

const WORDS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
];
export const countWord = (n: number) => WORDS[n] ?? String(n);

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function paxLabel(pax: { adults: number; children: number }): string {
  const parts = [plural(pax.adults, "adult")];
  if (pax.children) parts.push(plural(pax.children, "child", "children"));
  return parts.join(", ");
}

export function initials(name: string): string {
  const words = name
    .replace(/[^\p{L}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase() || "·";
}

/** "14 to 18 Mar 2027" · "28 Feb to 3 Mar 2027" · "30 Dec 2026 to 2 Jan 2027". */
export function dateRangeWords(start: string, end: string): string {
  const [a, b] = [formatDate(start), formatDate(end)];
  const [ad, am, ay] = a.split(" ");
  const [, bm, by] = b.split(" ");
  if (ay !== by) return `${a} to ${b}`;
  if (am !== bm) return `${ad} ${am} to ${b}`;
  return `${ad} to ${b}`;
}

const weekday = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "Asia/Kolkata",
});
/** "SUN 14 MAR" */
function dowDate(iso: string): string {
  return weekday
    .format(new Date(`${iso}T00:00:00+05:30`))
    .replace(/,/g, "")
    .toUpperCase();
}
function year(iso: string): string {
  return iso.slice(0, 4);
}

/** Free-text section → list items (one per line, bullets stripped). */
export function lines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-*•·]|\d+[.)])\s*/, "").trim())
    .filter(Boolean);
}

/** Stock credits as "<photographer> / Pexels" (deviation 2). */
export function stockCredit(attribution: string | null | undefined): string | null {
  const a = (attribution ?? "").trim();
  if (!a) return null;
  const m =
    /^(?:photo(?::|\s+by)?\s+)?(.+?)\s+(?:on|\/|·)\s+(pexels|wikimedia(?: commons)?)$/i.exec(a);
  if (m) return `${m[1]} / ${m[2]!.toLowerCase() === "pexels" ? "Pexels" : "Wikimedia Commons"}`;
  return a.replace(/^Photo:\s*/i, "");
}

function image(img: EditorImage | null | undefined, caption: string): ShareImage | null {
  if (!img) return null;
  const google = img.source === "place";
  const credit = google
    ? `Photo: ${img.attribution ?? "Google Maps contributor"} · Google Maps`
    : stockCredit(img.attribution);
  return { url: img.url, caption, credit, google };
}

function heroCaption(day: EditorDoc["days"][number]): string {
  const hero = day.hero;
  const stop = hero ? day.stops.find((s) => s.image?.ref === hero.ref) : undefined;
  if (stop)
    return stop.title.includes(day.city) || !day.city ? stop.title : `${stop.title}, ${day.city}`;
  return day.city || day.title;
}

function hotelArea(address: string | null, city: string): string {
  const area = areaOf(address, city);
  return area === city || !city ? area : `${area}, ${city}`;
}

function checkInLine(inT: string | null, outT: string | null): string {
  const a = inT ? `From ${formatClock(inT)}` : "";
  const b = outT ? `out ${formatClock(outT)}` : "";
  return [a, b].filter(Boolean).join(" · ");
}

export function buildPrice(
  doc: Pick<EditorDoc, "pricing" | "client">,
  nights: number,
): SharePrice | null {
  const p = doc.pricing;
  if (!p.show) return null;
  const pax = doc.client?.pax ?? NO_PAX;
  const s = computePricing(p, pax);
  if (!s.headline || s.total === null) return null;
  const who = paxLabel(pax);
  const taxNote = p.tax_note?.trim() ?? "";
  const childAges = pax.child_ages.length ? ` (${pax.child_ages.join(", ")})` : "";
  switch (p.mode) {
    case "total":
      return {
        amount: formatINR(s.total),
        unitLine: `for ${who}${nights ? `, ${plural(nights, "night")}` : ""}`,
        lines: [],
        total: null,
        totalLabel: "Total for your trip",
        taxNote,
        bar: { amount: formatINR(s.total), line: `total · ${who}` },
      };
    case "per_person":
      return {
        amount: formatINR(s.headline.amount),
        unitLine: "per person",
        lines: s.lines.map((l) => ({
          // "2 adults × ₹42,250" when everyone is an adult (PNG 33), else "3 people × …".
          label: `${pax.children ? l.label : who} × ${formatINR(l.unit)}`,
          amount: formatINR(l.amount),
        })),
        total: formatINR(s.total),
        totalLabel: "Total for your trip",
        taxNote,
        bar: { amount: formatINR(s.headline.amount), line: `per person · ${who}` },
      };
    case "per_adult_child":
      return {
        amount: formatINR(s.total),
        unitLine: `for ${who}`,
        lines: s.lines.map((l, i) => ({
          label: `${l.label}${i === 1 ? childAges : ""} × ${formatINR(l.unit)}`,
          amount: formatINR(l.amount),
        })),
        total: formatINR(s.total),
        totalLabel: "Total for your trip",
        taxNote,
        bar: { amount: formatINR(s.total), line: `total · ${who}` },
      };
  }
}

/** Part 2 deviation 2: "Photos: Google Maps contributors · A, B" (+ "· X / Pexels"). */
export function creditLine(images: (ShareImage | null)[]): string {
  const google = new Set<string>();
  const other = new Set<string>();
  let anyGoogle = false;
  for (const img of images) {
    if (!img) continue;
    if (img.google) {
      anyGoogle = true;
      const name = img.credit?.replace(/^Photo: /, "").replace(/ · Google Maps$/, "");
      if (name && name !== "Google Maps contributor") google.add(name);
    } else if (img.credit) other.add(img.credit);
  }
  const parts: string[] = [];
  if (anyGoogle)
    parts.push(
      ["Photos: Google Maps contributors", [...google].join(", ")].filter(Boolean).join(" · "),
    );
  for (const o of other) parts.push(o);
  if (!parts.length) return "";
  return anyGoogle ? parts.join(" · ") : `Photos: ${parts.join(" · ")}`;
}

export function buildAgency(name: string, b: TenantBranding, itineraryTitle: string): ShareAgency {
  const ask = clientAskMessage({ title: itineraryTitle });
  const contacts: ContactRow[] = [];
  if (b.whatsapp)
    contacts.push({ label: "WhatsApp", value: b.whatsapp, href: waHref(b.whatsapp, ask) });
  if (b.phone) contacts.push({ label: "Phone", value: b.phone, href: telHref(b.phone) });
  if (b.email) contacts.push({ label: "Email", value: b.email, href: `mailto:${b.email}` });
  if (b.address) contacts.push({ label: "Office", value: b.address });
  if (b.website)
    contacts.push({
      label: "Website",
      value: b.website.replace(/^https?:\/\//, "").replace(/\/$/, ""),
      href: /^https?:\/\//.test(b.website) ? b.website : `https://${b.website}`,
    });
  if (b.gstin) contacts.push({ label: "GSTIN", value: b.gstin });
  if (b.licence_no) contacts.push({ label: "Licence", value: b.licence_no });
  const wa = b.whatsapp || b.phone;
  return {
    name,
    initials: initials(name),
    tagline: b.tagline ?? "",
    logoUrl: b.logo_url,
    accent: b.theme_color,
    footer: b.footer,
    contactPerson: b.contact_person ?? "",
    phone: b.phone,
    phoneHref: b.phone ? telHref(b.phone) : null,
    whatsappHref: wa ? waHref(wa, ask) : null,
    email: b.email,
    website: b.website.replace(/^https?:\/\//, "").replace(/\/$/, ""),
    contacts,
  };
}

export function buildShareView(input: {
  doc: EditorDoc;
  agencyName: string;
  branding: TenantBranding;
  defaults?: TenantDefaults;
  summary: string;
  updatedAt: Date;
  now?: Date;
}): ShareView {
  const { doc } = input;
  const nights = Math.max(0, doc.days.length - 1);
  const agency = buildAgency(input.agencyName, input.branding, doc.title);
  const client = doc.client?.name.trim() ?? "";
  const pax = paxLabel(doc.client?.pax ?? NO_PAX);
  const range = doc.startDate && doc.endDate ? dateRangeWords(doc.startDate, doc.endDate) : null;

  let night = 0;
  const days: ShareDay[] = doc.days.map((d, i) => {
    const n = i + 1;
    const date = d.date ? dowDate(d.date) : "";
    const hotel = d.hotel
      ? (() => {
          night++;
          const meal = d.hotel.mealPlan
            ? `${MEALS[d.hotel.mealPlan] ?? d.hotel.mealPlan} (${d.hotel.mealPlan})`
            : "";
          const rows = [
            d.hotel.roomType ? { label: "Room", value: d.hotel.roomType } : null,
            meal ? { label: "Meals", value: meal } : null,
            d.hotel.checkIn || d.hotel.checkOut
              ? { label: "Check-in", value: checkInLine(d.hotel.checkIn, d.hotel.checkOut) }
              : null,
          ].filter((r): r is { label: string; value: string } => !!r);
          const city = d.hotel.city ?? d.city;
          return {
            eyebrow: `NIGHT ${night}${date ? ` · ${date}` : ""}`,
            name: d.hotel.name,
            area: hotelArea(d.hotel.address, city),
            image: image(d.hotel.image, d.hotel.name),
            rows,
          } satisfies ShareHotel;
        })()
      : null;
    return {
      n,
      anchor: `day-${n}`,
      eyebrow: `DAY ${n}${date ? ` · ${date}` : ""}`,
      eyebrowPrint: `DAY ${n}${date ? ` · ${date} ${year(d.date!)}` : ""}`,
      dateShort: d.date ? formatDate(d.date).split(" ").slice(0, 2).join(" ") : "",
      title: d.title,
      city: d.city,
      hero: image(d.hero, heroCaption(d)),
      transport: d.transport,
      stops: d.stops.map((s) => ({
        time: formatClock(s.time),
        title: s.title,
        line: s.description,
      })),
      hotel,
      nightLine: hotel ? `Night ${night} · ${hotel.name}` : "Departure · no hotel",
    };
  });

  const sections = doc.sections;
  const allImages = days.flatMap((d) => [d.hero, d.hotel?.image ?? null]);
  const cities = doc.days.map((d) => d.city).filter(Boolean);
  const route = cities.filter((c, i) => c !== cities[i - 1]).join(" · ");
  const now = input.now ?? new Date();

  return {
    agency,
    title: doc.title,
    preparedFor: client ? `PREPARED FOR ${client.toUpperCase()}` : null,
    meta: [range, nights ? plural(nights, "night") : null, pax].filter(Boolean).join(" · "),
    dateRange: range,
    nightsLabel: plural(nights, "night"),
    summary: input.summary,
    route,
    cover: days[0]?.hero ?? null,
    days,
    price: buildPrice(doc, nights),
    sections: {
      included: lines(sections.inclusions),
      excluded: lines(sections.exclusions),
      payment: sections.payment_terms.trim(),
      cancellation: sections.cancellation.trim(),
    },
    lastUpdated: formatDate(input.updatedAt),
    printedOn: formatDate(now),
    credits: creditLine(allImages),
    footerTitle: doc.title,
    countWord: countWord(days.length),
  };
}
