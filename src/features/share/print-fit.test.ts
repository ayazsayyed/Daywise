import { describe, expect, it } from "vitest";

import { fitHeroWidth, PRINT_CONTENT_HEIGHT_PX, PRINT_CONTENT_WIDTH_PX } from "./print-fit";

// Turkey 7-day (#19) measured at print width: column 680, day hero 598×399.
const day = { frameWidth: 598, frameHeight: 399, columnWidth: 680 };

describe("fitHeroWidth (#19)", () => {
  it("matches the @page box in share.css (A4, 15 mm sides, 15/18 mm top/bottom)", () => {
    expect(Math.round(PRINT_CONTENT_WIDTH_PX)).toBe(680);
    expect(Math.round(PRINT_CONTENT_HEIGHT_PX)).toBe(998);
  });

  it("leaves a block that already fits one page alone", () => {
    expect(fitHeroWidth({ ...day, blockHeight: 900 })).toBeNull();
  });

  it("narrows the hero (keeping 3:2) just enough for a slightly long day to fit", () => {
    const blockHeight = 1060;
    const w = fitHeroWidth({ ...day, blockHeight })!;
    expect(w).toBeLessThan(598);
    const saved = 399 - (w * 2) / 3;
    expect(blockHeight - saved).toBeLessThanOrEqual(PRINT_CONTENT_HEIGHT_PX - 24);
  });

  it("gives up on days that cannot fit even at half the column (they flow, hotel moves whole)", () => {
    expect(fitHeroWidth({ ...day, blockHeight: 1500 })).toBeNull();
  });

  it("never returns a width below half the column", () => {
    const w = fitHeroWidth({ ...day, blockHeight: 1220 });
    if (w !== null) expect(w).toBeGreaterThanOrEqual(340);
  });
});
