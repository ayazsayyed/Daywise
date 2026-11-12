import { describe, expect, it } from "vitest";

import { normaliseQuery, parsePlace, PLACES_FIELD_MASK } from "./client";
import { decodePhotoRef, encodePhotoRef, photoUrl } from "./photo";

describe("places client", () => {
  it("uses exactly the locked field mask (no rating, no reviews)", () => {
    expect(PLACES_FIELD_MASK).toBe(
      "places.id,places.displayName,places.formattedAddress,places.location,places.photos",
    );
    expect(PLACES_FIELD_MASK).not.toMatch(/rating|review/);
  });

  it("normalises cache keys", () => {
    expect(normaliseQuery("  The Khyber,   Gulmarg ")).toBe("the khyber, gulmarg");
    expect(normaliseQuery("x", { lat: 34.0484, lng: 74.3805, radiusM: 1 })).toBe("x @34.05,74.38");
  });

  it("keeps photo resource names and author attribution, never bytes", () => {
    const p = parsePlace({
      id: "ChIJ123",
      displayName: { text: "The Khyber Himalayan Resort & Spa" },
      formattedAddress: "Gulmarg",
      location: { latitude: 34.05, longitude: 74.38 },
      photos: [
        {
          name: "places/ChIJ123/photos/AbC",
          widthPx: 4000,
          heightPx: 3000,
          authorAttributions: [{ displayName: "A Guest", uri: "https://maps.google.com/x" }],
        },
      ],
    });
    expect(p?.photos[0]).toEqual({
      name: "places/ChIJ123/photos/AbC",
      widthPx: 4000,
      heightPx: 3000,
      attribution: "A Guest",
      attributionUrl: "https://maps.google.com/x",
    });
  });
});

describe("photo refs", () => {
  it("round-trips a resource name and caps width at 1200", () => {
    const name = "places/ChIJ123/photos/AbC_def-ghi";
    const ref = encodePhotoRef(name);
    expect(decodePhotoRef(ref)).toBe(name);
    expect(photoUrl(name, 4000)).toBe(`/api/photo/${ref}?w=1200`);
    expect(photoUrl(name, 400)).toBe(`/api/photo/${ref}?w=400`);
  });
  it("rejects refs that are not Places photo names", () => {
    expect(decodePhotoRef(Buffer.from("https://evil.test/x").toString("base64url"))).toBeNull();
    expect(decodePhotoRef("not base64!!")).toBeNull();
  });

  it("round-trips a real-length photo resource name (~460 chars)", () => {
    const name = `places/ChIJR2iHaMKF4TgReVGZlZLvbb8/photos/${"AV-0GLdIalVsN_6oM6".repeat(24)}`;
    expect(name.length).toBeGreaterThan(450);
    const url = photoUrl(name, 800);
    const ref = url.split("/api/photo/")[1]!.split("?")[0]!;
    expect(decodePhotoRef(ref)).toBe(name);
  });
});
