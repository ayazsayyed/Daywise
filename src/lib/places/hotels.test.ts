import { describe, expect, it } from "vitest";

import { briefToPrompt } from "@/lib/ai/generate";
import { briefSchema, itinerarySchemaFor } from "@/lib/ai/schemas";

import type { PlaceResult } from "./client";
import {
  areaOf,
  candidateQueries,
  filterCandidates,
  findCandidate,
  hotelCandidatesPrompt,
  mergeCandidates,
  type HotelCandidates,
} from "./hotels";

const place = (id: string, name: string, address: string): PlaceResult => ({
  id,
  name,
  address,
  location: null,
  photos: [],
});

const candidates: HotelCandidates = {
  srinagar: mergeCandidates(
    [
      [
        place(
          "a",
          "The Lalit Grand Palace Srinagar",
          "Gupkar Rd, Srinagar, Jammu and Kashmir 190001, India",
        ),
        place(
          "b",
          "Hotel Heevan",
          "Boulevard Rd, Dal Lake, Srinagar, Jammu and Kashmir 190001, India",
        ),
      ],
      [place("b", "Hotel Heevan", "Boulevard Rd, Dal Lake, Srinagar, 190001, India")],
    ],
    "Srinagar",
  ),
  gulmarg: mergeCandidates(
    [[place("c", "The Khyber Himalayan Resort & Spa", "Gulmarg, Jammu and Kashmir 193403, India")]],
    "Gulmarg",
  ),
};

describe("hotel candidates (#13)", () => {
  it("queries the budget tier and plain hotels for each city", () => {
    expect(candidateQueries("Srinagar", "mid-range")).toEqual([
      "mid-range hotels in Srinagar",
      "hotels in Srinagar",
    ]);
  });

  it("dedupes by place id and keeps a short area", () => {
    expect(candidates.srinagar!.map((c) => c.placeId)).toEqual(["a", "b"]);
    expect(candidates.srinagar![1]!.area).toBe("Dal Lake");
    expect(areaOf(null, "Gulmarg")).toBe("Gulmarg");
  });

  it("puts the candidates into the itinerary prompt", () => {
    const brief = briefSchema.parse({
      destination: "Kashmir",
      country: "India",
      cities: ["Srinagar", "Gulmarg"],
      nights: 4,
      start_date: null,
      season: null,
      pax: { adults: 2, children: 0, child_ages: [] },
      budget: "mid-range",
      pace: "balanced",
      entry_city: "Srinagar",
      exit_city: "Srinagar",
      must_sees: [],
      notes: null,
      currency: "INR",
      assumed: [],
    });
    const prompt = briefToPrompt(brief, { hotels: candidates });
    expect(prompt).toContain("Choose hotels only from the list");
    expect(prompt).toContain("Candidates for Srinagar:");
    expect(prompt).toContain("- Hotel Heevan · Dal Lake");
    expect(prompt).toContain("- The Khyber Himalayan Resort & Spa");
    expect(briefToPrompt(brief)).not.toContain("Hotel candidates");
    expect(hotelCandidatesPrompt({ srinagar: [] })).toBe("");
  });

  it("matches a drafted hotel to its candidate", () => {
    expect(findCandidate("Hotel Heevan", "Srinagar", candidates)?.placeId).toBe("b");
    expect(findCandidate("Khyber Himalayan Resort and Spa", "Gulmarg", candidates)?.placeId).toBe(
      "c",
    );
  });

  it("an off-list hotel still validates but has no candidate (flagged)", () => {
    const brief = briefSchema.parse({
      destination: "Kashmir",
      country: "India",
      cities: ["Srinagar"],
      nights: 1,
      start_date: null,
      season: null,
      pax: { adults: 2, children: 0, child_ages: [] },
      budget: "mid-range",
      pace: "balanced",
      entry_city: "Srinagar",
      exit_city: "Srinagar",
      must_sees: [],
      notes: null,
      currency: "INR",
      assumed: [],
    });
    const draft = {
      title: "Kashmir",
      summary: "Two days in Srinagar.",
      notes: ["Timings and sightseeing are subject to weather and local conditions."],
      days: [
        {
          day_number: 1,
          title: "Arrival and Dal Lake",
          city: "Srinagar",
          summary: "Arrive and settle in.",
          transport: "Private car from the airport, about 40 min",
          stops: [
            {
              time: "16:00",
              kind: "sight",
              title: "Dal Lake shikara",
              description: "Evening ride.",
              duration: "1 h",
              place_query: "Dal Lake, Srinagar",
            },
          ],
          hotel: {
            name: "Srinagar Residency",
            city: "Srinagar",
            room_type: "Deluxe room",
            meal_plan: "CP",
            check_in: "14:00",
            check_out: "11:00",
            place_query: "Srinagar Residency, Srinagar",
          },
        },
        {
          day_number: 2,
          title: "Departure",
          city: "Srinagar",
          summary: "Transfer to the airport.",
          transport: "Private car, about 40 min",
          stops: [
            {
              time: "10:00",
              kind: "transfer",
              title: "Airport transfer",
              description: "Drop at Srinagar airport.",
              duration: "40 min",
              place_query: null,
            },
          ],
          hotel: null,
        },
      ],
    };
    const parsed = itinerarySchemaFor(brief).safeParse(draft);
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
    expect(findCandidate("Srinagar Residency", "Srinagar", candidates)).toBeNull();
  });

  it("filters candidates for the swap search", () => {
    expect(filterCandidates("heevan", candidates.srinagar!).map((c) => c.placeId)).toEqual(["b"]);
    expect(filterCandidates("dal lake hotel", candidates.srinagar!).map((c) => c.placeId)).toEqual([
      "b",
    ]);
    expect(filterCandidates("hotels", candidates.srinagar!)).toHaveLength(2);
  });
});
