import { describe, expect, it } from "vitest";

import { nameMatches } from "./verify";

describe("nameMatches", () => {
  it("accepts the same hotel with minor differences", () => {
    expect(
      nameMatches("The Khyber Himalayan Resort & Spa, Gulmarg", "Khyber Himalayan Resort and Spa"),
    ).toBe(true);
    expect(nameMatches("Dal Lake, Srinagar", "Dal Lake")).toBe(true);
    expect(nameMatches("WelcomHotel Pine N Peak, Pahalgam", "WelcomHotel Pine-N-Peak")).toBe(true);
  });
  it("rejects a different property in the same town", () => {
    expect(nameMatches("Hotel Highlands Park, Gulmarg", "The Khyber Himalayan Resort")).toBe(false);
    expect(nameMatches("Nishat Bagh, Srinagar", "Shalimar Bagh")).toBe(false);
  });
});
