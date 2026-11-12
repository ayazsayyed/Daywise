import { describe, expect, it } from "vitest";

import { computePricing, EMPTY_PRICING, parseRupees, type Pricing } from "./pricing";

const p = (patch: Partial<Pricing>): Pricing => ({ ...EMPTY_PRICING, ...patch });

describe("computePricing", () => {
  it("total mode is the entered total", () => {
    const s = computePricing(p({ mode: "total", total: 84_500 }), { adults: 2, children: 0 });
    expect(s.total).toBe(84_500);
    expect(s.headline).toEqual({ amount: 84_500, unit: "total" });
  });

  it("per person multiplies by every traveller", () => {
    const s = computePricing(p({ mode: "per_person", per_person: 42_250 }), {
      adults: 2,
      children: 1,
    });
    expect(s.total).toBe(126_750);
    expect(s.lines[0]).toMatchObject({ label: "3 people", qty: 3, unit: 42_250 });
  });

  it("per adult + child adds both lines", () => {
    const s = computePricing(p({ mode: "per_adult_child", per_adult: 42_250, per_child: 18_000 }), {
      adults: 2,
      children: 2,
    });
    expect(s.total).toBe(2 * 42_250 + 2 * 18_000);
    expect(s.lines.map((l) => l.label)).toEqual(["2 adults", "2 children"]);
    expect(s.headline?.unit).toBe("per adult");
  });

  it("per adult + child without children ignores the child price", () => {
    const s = computePricing(p({ mode: "per_adult_child", per_adult: 30_000 }), {
      adults: 2,
      children: 0,
    });
    expect(s.total).toBe(60_000);
  });

  it("is unpriced when amounts are missing", () => {
    expect(computePricing(p({ mode: "total" }), { adults: 2, children: 0 }).total).toBeNull();
    expect(
      computePricing(p({ mode: "per_adult_child", per_adult: 1 }), { adults: 2, children: 1 })
        .total,
    ).toBeNull();
  });
});

describe("parseRupees", () => {
  it.each([
    ["₹42,250", 42_250],
    ["1,84,500", 184_500],
    ["Rs. 500", 500],
    ["", null],
    ["12.5", undefined],
    ["abc", undefined],
  ])("%s → %s", (input, expected) => {
    expect(parseRupees(input)).toBe(expected);
  });
});
