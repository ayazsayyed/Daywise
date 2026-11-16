import type { ImageRef } from "@/lib/db/schema";
import type { EditorDoc, EditorImage } from "@/lib/itinerary/doc";

/**
 * Cover photo heuristic (DESIGN.md Part 2 "PDF styles"): two verified,
 * landscape photos from two different places, highest resolution first,
 * day heroes before hotel photos. The agent can override the pick in the
 * share panel ("Cover photos"); that choice is stored on the itinerary.
 */

export type CoverCandidate = {
  image: EditorImage;
  caption: string;
  city: string;
  kind: "hero" | "hotel";
};

/** All photos the picker may use, in itinerary order, de-duplicated by ref. */
export function coverCandidates(doc: EditorDoc): CoverCandidate[] {
  const seen = new Set<string>();
  const out: CoverCandidate[] = [];
  const push = (
    image: EditorImage | null,
    caption: string,
    city: string,
    kind: CoverCandidate["kind"],
  ) => {
    if (!image || image.source === "placeholder" || seen.has(image.ref)) return;
    seen.add(image.ref);
    out.push({ image, caption, city, kind });
  };
  for (const d of doc.days) push(d.hero, d.city || d.title, d.city, "hero");
  for (const d of doc.days)
    if (d.hotel) push(d.hotel.image, d.hotel.name, d.hotel.city ?? d.city, "hotel");
  return out;
}

const ratioOf = (i: EditorImage) => (i.width && i.height ? i.width / i.height : null);

/** Higher is better. Unknown sizes rank below known landscapes, above portraits. */
export function coverScore(c: CoverCandidate): number {
  const r = ratioOf(c.image);
  const landscape = r === null ? 0.5 : r >= 1.2 ? 1 : r >= 1 ? 0.6 : 0;
  const pixels = c.image.width && c.image.height ? c.image.width * c.image.height : 1_000_000;
  const kind = c.kind === "hero" ? 1 : 0.6;
  const verified = c.image.source === "place" ? 1 : 0.9; // stock photos are fine, Places preferred
  return landscape * 10 + kind * 4 + verified + Math.min(pixels / 20_000_000, 1);
}

/** Best two from different places; a second from the same place only if nothing else exists. */
export function pickCoverPhotos(doc: EditorDoc, count = 2): CoverCandidate[] {
  const ranked = coverCandidates(doc)
    .filter((c) => (ratioOf(c.image) ?? 1.5) >= 1) // never a portrait on the cover
    .sort((a, b) => coverScore(b) - coverScore(a));
  const picked: CoverCandidate[] = [];
  const places = new Set<string>();
  for (const c of ranked) {
    if (picked.length >= count) break;
    const place = c.city.toLowerCase().trim();
    if (place && places.has(place)) continue;
    picked.push(c);
    places.add(place);
  }
  for (const c of ranked) {
    if (picked.length >= count) break;
    if (!picked.includes(c)) picked.push(c);
  }
  return picked;
}

/** Override stored on the itinerary → candidates (only refs that still exist in the itinerary). */
export function resolveOverride(
  doc: EditorDoc,
  refs: ImageRef[] | null | undefined,
): CoverCandidate[] | null {
  if (!refs?.length) return null;
  const all = coverCandidates(doc);
  const found = refs
    .map((r) => all.find((c) => c.image.ref === r.ref && c.image.source === r.source))
    .filter((c): c is CoverCandidate => !!c);
  return found.length ? found : null;
}
