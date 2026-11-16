import {
  A4_MM,
  BACKDROP_MIN_PX,
  BACKDROP_RATIO,
  BACKDROP_RATIO_TOLERANCE,
  PAGE_NUMBER_PT,
} from "./constants";

/** mm → PDF points (72 per inch). */
export const mmToPt = (mm: number) => (mm * 72) / 25.4;

export type ImageCheck = { ok: true } | { ok: false; message: string };

/** Backdrop: A4 portrait ±1%, at least 2480 × 3508 px. */
export function checkBackdropDimensions(w: number, h: number): ImageCheck {
  if (w >= h)
    return { ok: false, message: `This image is landscape (${w} × ${h} px). Use A4 portrait.` };
  const ratio = h / w;
  if (Math.abs(ratio - BACKDROP_RATIO) / BACKDROP_RATIO > BACKDROP_RATIO_TOLERANCE)
    return {
      ok: false,
      message: `This image is ${w} × ${h} px, which is not A4 (1 : 1.414). Use ${BACKDROP_MIN_PX.w} × ${BACKDROP_MIN_PX.h} px.`,
    };
  if (w < BACKDROP_MIN_PX.w || h < BACKDROP_MIN_PX.h)
    return {
      ok: false,
      message: `This image is ${w} × ${h} px; the minimum is ${BACKDROP_MIN_PX.w} × ${BACKDROP_MIN_PX.h} px (A4 at 300 dpi).`,
    };
  return { ok: true };
}

/** "Page 02 of 17": two digits minimum. */
export function pageLabel(n: number, total: number): string {
  const pad = (x: number) => String(x).padStart(2, "0");
  return `Page ${pad(n)} of ${pad(total)}`;
}

/** Where a style wants its page number, in mm from the bottom-right or bottom-left edge. */
export type StampSpec = {
  align: "left" | "center" | "right";
  /** Distance of the text baseline from the page bottom, mm. */
  bottomMm: number;
  /** Distance from the side edge (ignored for center), mm. */
  sideMm: number;
  color: string;
  /** "Page 02 of 17" (default) or just "02". */
  format?: "long" | "short";
};

/**
 * Stamp position in PDF points from the bottom-left corner (pdf-lib's origin).
 * `textWidth` is the label's measured width at 9pt.
 */
export function stampPosition(
  spec: Pick<StampSpec, "align" | "bottomMm" | "sideMm">,
  textWidth: number,
  pageWidthPt = mmToPt(A4_MM.w),
): { x: number; y: number; size: number } {
  const side = mmToPt(spec.sideMm);
  const x =
    spec.align === "left"
      ? side
      : spec.align === "right"
        ? pageWidthPt - side - textWidth
        : (pageWidthPt - textWidth) / 2;
  return { x, y: mmToPt(spec.bottomMm), size: PAGE_NUMBER_PT };
}

export type PrintPart = "cover" | "body" | "last";
export const PRINT_PARTS: PrintPart[] = ["cover", "body", "last"];

export function isPrintPart(v: unknown): v is PrintPart {
  return v === "cover" || v === "body" || v === "last";
}
