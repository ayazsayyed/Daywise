/**
 * Colour maths for the tenant theme colour. DESIGN.md Part 2 deviation 5: the
 * accent must reach ≥ 4.5:1 against `surface` (#F7F5F1); Settings validates and
 * offers a darkened version when it fails.
 */
export const SURFACE_HEX = "#F7F5F1";
export const MIN_CONTRAST = 4.5;

const HEX = /^#([0-9a-fA-F]{6})$/;

export function isHex(hex: string): boolean {
  return HEX.test(hex);
}

function channels(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

/** WCAG relative luminance (0 = black, 1 = white). */
export function relativeLuminance(hex: string): number {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = channels(hex);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG contrast ratio between two colours, ≥ 1. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export function readableOnSurface(hex: string): boolean {
  return isHex(hex) && contrastRatio(hex, SURFACE_HEX) >= MIN_CONTRAST;
}

/**
 * Darkens a colour (keeping its hue) until it reads on surface.
 * Returns the input unchanged when it already passes.
 */
export function darkenToReadable(hex: string): string {
  if (!isHex(hex)) return hex;
  let rgb = channels(hex);
  let out = toHex(rgb);
  for (let i = 0; i < 40 && contrastRatio(out, SURFACE_HEX) < MIN_CONTRAST; i++) {
    rgb = rgb.map((v) => v * 0.92) as [number, number, number];
    out = toHex(rgb);
  }
  return out;
}
