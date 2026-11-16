import { describe, expect, it } from "vitest";

import { contrastRatio } from "@/lib/color";

import { WARM_GOLD } from "./constants";
import {
  backdropTextFor,
  buildTokens,
  deriveAccent,
  ensureContrast,
  isDarkOrCool,
  textOn,
} from "./tokens";

describe("deriveAccent", () => {
  it("gives warm gold for dark or cool primaries", () => {
    expect(isDarkOrCool("#0E4A5A")).toBe(true); // SKTW teal
    expect(isDarkOrCool("#2E3A8C")).toBe(true); // indigo
    expect(isDarkOrCool("#1C1B19")).toBe(true); // near black
    expect(deriveAccent("#0E4A5A")).toBe(WARM_GOLD);
    expect(deriveAccent("#2E3A8C")).toBe(WARM_GOLD);
  });

  it("gives a darker shade of a warm primary", () => {
    expect(isDarkOrCool("#B5541B")).toBe(false); // saffron-brown
    const a = deriveAccent("#B5541B");
    expect(a).not.toBe(WARM_GOLD);
    expect(contrastRatio(a, "#FFFFFF")).toBeGreaterThan(contrastRatio("#B5541B", "#FFFFFF"));
  });

  it("falls back to gold for an invalid colour", () => {
    expect(deriveAccent("teal")).toBe(WARM_GOLD);
  });
});

describe("contrast fallbacks", () => {
  it("ensureContrast reaches the minimum or returns the input when it already passes", () => {
    expect(ensureContrast("#1C1B19", "#FFFFFF", 4.5)).toBe("#1C1B19");
    const fixed = ensureContrast("#F5E6A8", "#FFFFFF", 4.5);
    expect(contrastRatio(fixed, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
    const onDark = ensureContrast("#3A3A3A", "#0E4A5A", 4.5);
    expect(contrastRatio(onDark, "#0E4A5A")).toBeGreaterThanOrEqual(4.5);
  });

  it("textOn picks white on dark and ink on light", () => {
    expect(textOn("#0E4A5A")).toBe("#FFFFFF");
    expect(textOn("#F2E9D8")).toBe("#1C1B19");
  });

  it("every token pairing a style prints is readable, even for awkward colours", () => {
    for (const [primary, accent] of [
      ["#0E4A5A", "#C9A227"],
      ["#F2D16B", "#F7E9B0"], // light primary, near-white accent
      ["#7A3B1D", null],
      ["#2E3A8C", "#2E3A8C"], // accent = primary
      ["#FFFFFF", "#FFFFFF"],
    ] as const) {
      const t = buildTokens({ primary, accent, titleFont: "inter" });
      expect(contrastRatio(t.onPrimary, t.primary)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(t.onPrimarySecondary, t.primary)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(t.accentOnPrimary, t.primary)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(t.accentOnPaper, t.paper)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(t.accentTextOnPaper, t.paper)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("accent defaults from the primary when unset", () => {
    expect(buildTokens({ primary: "#0E4A5A", accent: null, titleFont: "serif" }).accent).toBe(
      WARM_GOLD,
    );
  });
});

describe("backdrop text", () => {
  it("chooses light text on a dark region and dark text on a light one", () => {
    expect(backdropTextFor("#0B3440").text).toBe("light");
    expect(backdropTextFor("#EFE6D2").text).toBe("dark");
  });

  it("reports low contrast for a mid-grey region", () => {
    expect(backdropTextFor("#808080").contrast).toBeLessThan(4.5);
  });

  it("cover text follows the backdrop", () => {
    const dark = buildTokens({
      primary: "#0E4A5A",
      accent: null,
      titleFont: "inter",
      backdropUrl: "/x.png",
      backdropText: "dark",
    });
    expect(dark.coverText).toBe("#1C1B19");
    const light = buildTokens({
      primary: "#F2E9D8",
      accent: null,
      titleFont: "inter",
      backdropUrl: "/x.png",
      backdropText: "light",
    });
    expect(light.coverText).toBe("#FFFFFF");
  });
});
