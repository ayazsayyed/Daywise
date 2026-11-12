import { describe, expect, it } from "vitest";

import { mockBrief, mockItinerary } from "./mock";
import {
  attachDates,
  BUDGET_TIERS,
  briefDates,
  briefSchema,
  itinerarySchemaFor,
  mentionsMoneyOrRating,
} from "./schemas";
import { systemPrompt } from "./prompts";

const brief = mockBrief("5-day Kashmir couple mid-range", new Date("2026-11-08T00:00:00Z"));
const golden = mockItinerary(brief);

describe("brief schema", () => {
  it("accepts the mock brief and derives contiguous dates", () => {
    const b = briefSchema.parse(brief);
    expect(b.nights).toBe(4);
    const dates = briefDates(b)!;
    expect(dates).toHaveLength(5);
    expect(dates[0]).toBe("2026-12-08");
    expect(dates[4]).toBe("2026-12-12");
  });

  it("rejects unknown keys (no price fields from the AI)", () => {
    expect(briefSchema.safeParse({ ...brief, budget_inr: 85000 }).success).toBe(false);
  });

  it("reads Hinglish shorthand with Indian defaults", () => {
    const b = mockBrief("5 din kashmir couple sasta", new Date("2026-11-08T00:00:00Z"));
    expect(b.nights).toBe(4);
    expect(b.budget).toBe("budget");
    expect(b.currency).toBe("INR");
    expect(b.pax.adults).toBe(2);
    expect(b.assumed).toContain("start_date");
  });
});

describe("itinerary schema", () => {
  const schema = itinerarySchemaFor(brief);

  it("accepts the golden sample", () => {
    const r = schema.safeParse(golden);
    expect(r.success).toBe(true);
    const dated = attachDates(golden, brief);
    expect(dated.days.map((d) => d.date)).toEqual([
      "2026-12-08",
      "2026-12-09",
      "2026-12-10",
      "2026-12-11",
      "2026-12-12",
    ]);
  });

  it("rejects the wrong day count", () => {
    const short = { ...golden, days: golden.days.slice(0, 4) };
    const r = schema.safeParse(short);
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toMatch(/Expected 5 days/);
  });

  it("rejects a missing hotel night and a hotel on departure day", () => {
    const noHotel = structuredClone(golden);
    noHotel.days[1]!.hotel = null;
    expect(schema.safeParse(noHotel).success).toBe(false);

    const lastHotel = structuredClone(golden);
    lastHotel.days[4]!.hotel = structuredClone(golden.days[0]!.hotel);
    expect(schema.safeParse(lastHotel).success).toBe(false);
  });

  it("rejects price fields and money in text", () => {
    const priceKey = structuredClone(golden) as unknown as { days: Record<string, unknown>[] };
    priceKey.days[0]!.price = 12000;
    expect(schema.safeParse(priceKey).success).toBe(false);

    const hotelRate = structuredClone(golden) as unknown as {
      days: { hotel: Record<string, unknown> }[];
    };
    hotelRate.days[0]!.hotel.rate_per_night = 4500;
    expect(schema.safeParse(hotelRate).success).toBe(false);

    const moneyText = structuredClone(golden);
    moneyText.days[0]!.stops[0]!.description = "Shikara ride, about ₹1,200 per hour.";
    const r = schema.safeParse(moneyText);
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toMatch(/prices, availability or star ratings/);
  });

  it("rejects star ratings and bad meal plans", () => {
    const rated = structuredClone(golden);
    rated.days[0]!.hotel!.room_type = "Deluxe room in a 5-star property";
    expect(schema.safeParse(rated).success).toBe(false);

    const meal = structuredClone(golden) as unknown as { days: { hotel: { meal_plan: string } }[] };
    meal.days[0]!.hotel.meal_plan = "Breakfast";
    expect(schema.safeParse(meal).success).toBe(false);
  });
});

describe("money / rating detector", () => {
  it.each([
    ["₹2,500 per person", true],
    ["INR 1200", true],
    ["Rs. 500 entry", true],
    ["$40 cabana", true],
    ["3500 per night", true],
    ["4.5★ resort", true],
    ["a 5-star hotel", true],
    ["rated 4.3 on Google", true],
    ["Gondola phase 1 and 2, about 2 h", false],
    ["Check-in 14:00, room 204", false],
    ["Day 3 — Pahalgam", false],
  ])("%s → %s", (text, expected) => {
    expect(mentionsMoneyOrRating(text)).toBe(expected);
  });
});

describe("system prompts", () => {
  it("both prompts carry the no-money / no-availability / no-rating rule", () => {
    for (const name of ["itinerary", "enhancer"] as const) {
      const text = systemPrompt(name);
      expect(text).toMatch(/never state money/i);
      expect(text).toMatch(/availability/i);
      expect(text).toMatch(/star ratings/i);
    }
  });
});

describe("budget tiers (#8)", () => {
  it("has the four tiers of the brief form", () => {
    expect(BUDGET_TIERS).toEqual(["budget", "mid-range", "premium", "luxury"]);
    expect(briefSchema.safeParse({ ...brief, budget: "premium" }).success).toBe(true);
    expect(briefSchema.safeParse({ ...brief, budget: "4-star" }).success).toBe(false);
  });

  it("maps shorthand to the right tier", () => {
    const d = new Date("2026-11-08T00:00:00Z");
    expect(mockBrief("Kerala 6 days premium", d).budget).toBe("premium");
    expect(mockBrief("Kerala 6 days 4 star", d).budget).toBe("premium");
    expect(mockBrief("Kerala 6 days luxury", d).budget).toBe("luxury");
  });

  it("the enhancer and itinerary prompts know all four tiers", () => {
    for (const tier of BUDGET_TIERS) {
      expect(systemPrompt("enhancer")).toContain(`\`${tier}\``);
      expect(systemPrompt("itinerary")).toContain(`\`${tier}\``);
    }
  });
});

describe("departure day stops (#10)", () => {
  const schema = itinerarySchemaFor(brief);

  it("allows an empty departure day", () => {
    const it = structuredClone(golden);
    it.days[4]!.stops = [];
    expect(schema.safeParse(it).success).toBe(true);
  });

  it("still requires a stop on every other day", () => {
    const it = structuredClone(golden);
    it.days[2]!.stops = [];
    const r = schema.safeParse(it);
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toMatch(/Day 3 needs at least one stop/);
  });

  it("the prompt tells the model the departure day has the transfer stop", () => {
    expect(systemPrompt("itinerary")).toMatch(/departure day always has at least one stop/);
  });
});
