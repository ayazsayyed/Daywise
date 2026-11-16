import { describe, expect, it } from "vitest";

import type { EditorImage } from "@/lib/itinerary/doc";

import { coverCandidates, pickCoverPhotos, resolveOverride } from "./cover-photos";
import { sampleDoc } from "./sample";

const img = (
  ref: string,
  w?: number,
  h?: number,
  source: EditorImage["source"] = "place",
): EditorImage => ({
  source,
  ref,
  url: `/api/photo/${ref}`,
  credit: null,
  attribution: "A. Author",
  width: w,
  height: h,
});

/** Five-day fixture with photos set per test. */
function docWith(
  heroes: (EditorImage | null)[],
  hotels: (EditorImage | null)[] = [],
  cities = ["Srinagar", "Gulmarg", "Pahalgam", "Srinagar", "Srinagar"],
) {
  const d = sampleDoc({ days: 5 });
  d.days.forEach((day, i) => {
    day.city = cities[i] ?? day.city;
    day.hero = heroes[i] ?? null;
    if (day.hotel) day.hotel.image = hotels[i] ?? null;
  });
  return d;
}

describe("pickCoverPhotos", () => {
  it("prefers landscape day heroes from two different places, highest resolution first", () => {
    const d = docWith([
      img("srinagar-small", 800, 533),
      img("gulmarg-big", 4000, 2600),
      img("pahalgam-mid", 2400, 1600),
      img("srinagar-big", 4800, 3200),
    ]);
    const picked = pickCoverPhotos(d).map((c) => c.image.ref);
    expect(picked).toEqual(["srinagar-big", "gulmarg-big"]);
  });

  it("never puts a portrait on the cover", () => {
    const d = docWith([img("tall", 1000, 1600), img("wide", 1600, 1000), img("tall2", 900, 1600)]);
    expect(pickCoverPhotos(d).map((c) => c.image.ref)).toEqual(["wide"]);
  });

  it("ranks day heroes above hotel photos", () => {
    const d = docWith(
      [img("hero-a", 1600, 1000)],
      [img("hotel-big", 6000, 4000), img("hotel-b", 6000, 4000)],
    );
    expect(pickCoverPhotos(d)[0]!.image.ref).toBe("hero-a");
  });

  it("allows a second photo from the same place only when nothing else exists", () => {
    const d = docWith(
      [img("a", 1600, 1000), null, null, img("b", 1600, 1000)],
      [],
      ["Srinagar", "Srinagar", "Srinagar", "Srinagar", "Srinagar"],
    );
    expect(pickCoverPhotos(d).map((c) => c.image.ref)).toEqual(["a", "b"]);
  });

  it("skips placeholders and duplicates", () => {
    const d = docWith([
      img("same", 1600, 1000),
      img("same", 1600, 1000),
      img("p", 1600, 1000, "placeholder"),
    ]);
    expect(coverCandidates(d).map((c) => c.image.ref)).toEqual(["same"]);
  });

  it("returns nothing when the itinerary has no photos (the loader then uses destination photos)", () => {
    expect(pickCoverPhotos(sampleDoc({ days: 3 }))).toEqual([]);
  });
});

describe("resolveOverride", () => {
  it("keeps the agent's choice in order, dropping refs no longer in the itinerary", () => {
    const d = docWith([img("a", 1600, 1000), img("b", 1600, 1000)]);
    const r = resolveOverride(d, [
      { source: "place", ref: "b" },
      { source: "place", ref: "gone" },
      { source: "place", ref: "a" },
    ]);
    expect(r!.map((c) => c.image.ref)).toEqual(["b", "a"]);
  });

  it("is null when nothing was chosen or nothing survives", () => {
    const d = docWith([img("a", 1600, 1000)]);
    expect(resolveOverride(d, null)).toBeNull();
    expect(resolveOverride(d, [{ source: "place", ref: "gone" }])).toBeNull();
  });
});
