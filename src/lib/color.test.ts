import { describe, expect, it } from "vitest";

import { contrastRatio, darkenToReadable, readableOnSurface, SURFACE_HEX } from "./color";

describe("theme colour contrast guard", () => {
  it("accepts the design presets and the indigo", () => {
    for (const hex of ["#2E3A8C", "#7A3B1D", "#1F6B4A", "#7B2D5E", "#8A5A12", "#3B3A37"]) {
      expect(readableOnSurface(hex)).toBe(true);
    }
  });
  it("rejects a light saffron and offers a darker one that passes", () => {
    const saffron = "#F4A261";
    expect(readableOnSurface(saffron)).toBe(false);
    const fixed = darkenToReadable(saffron);
    expect(fixed).not.toBe(saffron);
    expect(contrastRatio(fixed, SURFACE_HEX)).toBeGreaterThanOrEqual(4.5);
    expect(fixed).toMatch(/^#[0-9A-F]{6}$/);
  });
  it("leaves a passing colour unchanged", () => {
    expect(darkenToReadable("#2E3A8C")).toBe("#2E3A8C");
  });
});
