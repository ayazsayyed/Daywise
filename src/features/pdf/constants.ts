/**
 * Generated PDF styles: one place for every number (DESIGN.md Part 2
 * "PDF styles"). Daywise draws the whole PDF from a style + tenant brand
 * tokens + itinerary data; tenants never upload page artwork.
 */

/** A4 portrait in mm. */
export const A4_MM = { w: 210, h: 297 } as const;
/** CSS px per mm at 96 dpi (what Chromium prints with). */
export const PX_PER_MM = 96 / 25.4;

/** Cover backdrop upload (styles that support one). */
export const BACKDROP_MIN_PX = { w: 2480, h: 3508 } as const; // A4 @ 300 dpi
export const BACKDROP_RATIO = A4_MM.h / A4_MM.w; // 1.4142…
export const BACKDROP_RATIO_TOLERANCE = 0.01; // ±1%
export const BACKDROP_MAX_BYTES = 8 * 1024 * 1024;
export const BACKDROP_TYPES = { "image/png": "png", "image/jpeg": "jpg" } as const;

export const TITLE_FONTS = ["inter", "serif"] as const;
export type TitleFont = (typeof TITLE_FONTS)[number];

/** Default accent when the primary is dark or cool (Part 2 "PDF styles"). */
export const WARM_GOLD = "#C9A227";
/** PDF paper and cream surfaces. */
export const PAPER = "#FFFFFF";
export const CREAM = "#F6F0E4";
export const INK = "#1C1B19";
export const INK_SECONDARY = "#5E5B55";
export const ON_DARK = "#FFFFFF";
export const ON_DARK_SECONDARY = "#E9E4DA";

/** Page-number stamp size: print-caption (9pt), never smaller. */
export const PAGE_NUMBER_PT = 9;
