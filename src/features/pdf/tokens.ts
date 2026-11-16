import { contrastRatio, isHex, relativeLuminance } from "@/lib/color";

import {
  CREAM,
  INK,
  INK_SECONDARY,
  ON_DARK,
  ON_DARK_SECONDARY,
  PAPER,
  WARM_GOLD,
  type TitleFont,
} from "./constants";

/**
 * Brand tokens → the colours a PDF style may use (DESIGN.md Part 2 "PDF
 * styles"). Every pairing a style prints is checked here, with automatic
 * fallbacks, so no style can ship unreadable text.
 */

const MIN_TEXT = 4.5; // body and small labels
const MIN_LARGE = 3; // display numbers, rules, flourishes

type RGB = [number, number, number];
const rgbOf = (hex: string): RGB => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const hexOf = ([r, g, b]: RGB) =>
  `#${[r, g, b]
    .map((v) =>
      Math.max(0, Math.min(255, Math.round(v)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`.toUpperCase();
export const mix = (a: string, b: string, t: number) => {
  const x = rgbOf(a);
  const y = rgbOf(b);
  return hexOf([0, 1, 2].map((i) => x[i]! + (y[i]! - x[i]!) * t) as RGB);
};

/** Hue in degrees (0–360) and saturation (0–1), HSL. */
export function hueSat(hex: string): { h: number; s: number } {
  const [r, g, b] = rgbOf(hex).map((v) => v / 255) as RGB;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return { h: 0, s: 0 };
  const l = (max + min) / 2;
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  return { h: h < 0 ? h + 360 : h, s };
}

/** Dark (luminance < 0.12) or cool (hue 150°–290° with some saturation). */
export function isDarkOrCool(hex: string): boolean {
  if (relativeLuminance(hex) < 0.12) return true;
  const { h, s } = hueSat(hex);
  return s > 0.15 && h >= 150 && h <= 290;
}

/** Accent default: warm gold for a dark/cool primary, else a darker shade of the primary. */
export function deriveAccent(primary: string): string {
  if (!isHex(primary)) return WARM_GOLD;
  return isDarkOrCool(primary) ? WARM_GOLD : mix(primary, "#000000", 0.32);
}

/** Moves `fg` toward white or black (whichever helps) until it reaches `min` against `bg`. */
export function ensureContrast(fg: string, bg: string, min: number): string {
  if (contrastRatio(fg, bg) >= min) return fg;
  const toward = relativeLuminance(bg) < 0.4 ? "#FFFFFF" : "#000000";
  for (let t = 0.05; t <= 1.0001; t += 0.05) {
    const c = mix(fg, toward, t);
    if (contrastRatio(c, bg) >= min) return c;
  }
  return toward === "#FFFFFF" ? ON_DARK : INK;
}

/** Text colour that reads on a ground: white or ink, whichever contrasts more. */
export function textOn(bg: string): string {
  return contrastRatio(ON_DARK, bg) >= contrastRatio(INK, bg) ? ON_DARK : INK;
}

export type PdfTokens = {
  primary: string;
  /** Text on the primary band (white or ink). */
  onPrimary: string;
  onPrimarySecondary: string;
  /** Raw accent as the tenant set it. */
  accent: string;
  /** Accent used for labels on the primary band (≥ 4.5:1). */
  accentOnPrimary: string;
  /** Accent used for rules and day numbers on paper (≥ 3:1). */
  accentOnPaper: string;
  /** Accent used for small text on paper (≥ 4.5:1). */
  accentTextOnPaper: string;
  paper: string;
  cream: string;
  ink: string;
  inkSecondary: string;
  titleFont: TitleFont;
  backdropUrl: string | null;
  /** Cover text over the band/backdrop. */
  coverText: string;
  coverTextSecondary: string;
};

export type TokenInput = {
  primary: string;
  accent: string | null;
  titleFont: TitleFont;
  backdropUrl?: string | null;
  backdropText?: "light" | "dark" | null;
};

export function buildTokens(input: TokenInput): PdfTokens {
  const primary = isHex(input.primary) ? input.primary.toUpperCase() : "#2E3A8C";
  const accent =
    input.accent && isHex(input.accent) ? input.accent.toUpperCase() : deriveAccent(primary);
  const onPrimary = textOn(primary);
  const onPrimarySecondary =
    onPrimary === ON_DARK ? ensureContrast(ON_DARK_SECONDARY, primary, MIN_TEXT) : INK_SECONDARY;
  const backdropLight = input.backdropUrl ? input.backdropText !== "dark" : onPrimary === ON_DARK;
  return {
    primary,
    onPrimary,
    onPrimarySecondary,
    accent,
    accentOnPrimary: ensureContrast(accent, primary, MIN_TEXT),
    accentOnPaper: ensureContrast(accent, PAPER, MIN_LARGE),
    accentTextOnPaper: ensureContrast(accent, PAPER, MIN_TEXT),
    paper: PAPER,
    cream: CREAM,
    ink: INK,
    inkSecondary: INK_SECONDARY,
    titleFont: input.titleFont,
    backdropUrl: input.backdropUrl ?? null,
    coverText: backdropLight ? ON_DARK : INK,
    coverTextSecondary: backdropLight ? ON_DARK_SECONDARY : INK_SECONDARY,
  };
}

/** CSS custom properties every style reads. */
export function tokenVars(t: PdfTokens): Record<string, string> {
  return {
    "--pdf-primary": t.primary,
    "--pdf-on-primary": t.onPrimary,
    "--pdf-on-primary-2": t.onPrimarySecondary,
    "--pdf-accent": t.accent,
    "--pdf-accent-on-primary": t.accentOnPrimary,
    "--pdf-accent-on-paper": t.accentOnPaper,
    "--pdf-accent-text": t.accentTextOnPaper,
    "--pdf-paper": t.paper,
    "--pdf-cream": t.cream,
    "--pdf-ink": t.ink,
    "--pdf-ink-2": t.inkSecondary,
    "--pdf-cover-text": t.coverText,
    "--pdf-cover-text-2": t.coverTextSecondary,
  };
}

/**
 * Backdrop analysis input: the mean colour of the cover text region (top 45%,
 * left 75%, where every backdrop style places its text). Returns the text
 * colour that reads best and its contrast.
 */
export function backdropTextFor(meanHex: string): { text: "light" | "dark"; contrast: number } {
  const light = contrastRatio(ON_DARK, meanHex);
  const dark = contrastRatio(INK, meanHex);
  return light >= dark
    ? { text: "light", contrast: Math.round(light * 100) / 100 }
    : { text: "dark", contrast: Math.round(dark * 100) / 100 };
}

export const BACKDROP_TEXT_REGION = { left: 0, top: 0, width: 0.75, height: 0.45 } as const;
export const MIN_BACKDROP_CONTRAST = MIN_TEXT;
