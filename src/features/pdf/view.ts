import type { ItineraryCover } from "@/lib/db/schema";
import type { EditorDoc } from "@/lib/itinerary/doc";

import {
  creditLine,
  paxLabel,
  shareImage,
  type ShareImage,
  type ShareView,
} from "@/features/share/view";

import { pickCoverPhotos, resolveOverride } from "./cover-photos";

/**
 * What a PDF style renders: the client page's view plus the cover fields only
 * the PDF uses (eyebrow, cover photos, structured meta). Pure.
 */
export type PdfView = {
  share: ShareView;
  eyebrow: string;
  clientName: string;
  /** "Prepared especially for Akil Shaikh", or null without a client. */
  preparedLine: string | null;
  /** Consecutive duplicates removed: Istanbul, Cappadocia, Istanbul. */
  routeCities: string[];
  dates: string | null;
  /** "6 nights · 7 days". */
  duration: string;
  travellers: string;
  year: string;
  coverPhotos: ShareImage[];
  credits: string;
};

export const DEFAULT_EYEBROW = "A journey through";

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

export function buildPdfView(input: {
  share: ShareView;
  doc: EditorDoc;
  cover: ItineraryCover | null;
  /** Pexels/Wikimedia destination photos to fill the cover when the itinerary has too few. */
  fallbackPhotos?: ShareImage[];
  now?: Date;
}): PdfView {
  const { share, doc } = input;
  const nights = Math.max(0, doc.days.length - 1);
  const client = doc.client?.name.trim() ?? "";
  const cities = doc.days.map((d) => d.city.trim()).filter(Boolean);
  const routeCities = cities.filter((c, i) => c !== cities[i - 1]);

  const chosen = resolveOverride(doc, input.cover?.photos) ?? pickCoverPhotos(doc);
  const coverPhotos = chosen
    .map((c) => shareImage(c.image, c.caption))
    .filter((i): i is ShareImage => !!i);
  for (const f of input.fallbackPhotos ?? []) {
    if (coverPhotos.length >= 2) break;
    if (!coverPhotos.some((p) => p.url === f.url)) coverPhotos.push(f);
  }

  const allImages = [
    ...share.days.flatMap((d) => [d.hero, d.hotel?.image ?? null]),
    ...coverPhotos,
  ];
  const yearSource = doc.startDate ?? (input.now ?? new Date()).toISOString().slice(0, 10);

  return {
    share,
    eyebrow: input.cover?.eyebrow?.trim() || DEFAULT_EYEBROW,
    clientName: client,
    preparedLine: client ? `Prepared especially for ${client}` : null,
    routeCities,
    dates: share.dateRange,
    duration: [nights ? plural(nights, "night") : null, plural(doc.days.length, "day")]
      .filter(Boolean)
      .join(" · "),
    travellers: paxLabel(doc.client?.pax ?? { adults: 2, children: 0 }),
    year: yearSource.slice(0, 4),
    coverPhotos,
    credits: creditLine(allImages),
  };
}
