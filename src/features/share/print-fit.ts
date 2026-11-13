/**
 * PDF page fitting (#19). The PDF prints the cover on one page, then one day
 * per page with the hotel card never split (DESIGN.md Part 2, PNG 35–36). A
 * day only a few lines too long pushed its whole hotel card onto a second,
 * mostly empty page, and a long "Where you stay" list spilled the cover.
 * The worker measures each block at print width and narrows its hero
 * (still 3:2) just enough for the block to fit one page. Blocks that cannot
 * fit even with the hero at half the column flow on as before.
 */

const PX_PER_MM = 96 / 25.4;

/** Content box of `@page` in share.css: A4, margins 15mm 15mm 18mm. */
export const PRINT_CONTENT_WIDTH_PX = (210 - 15 - 15) * PX_PER_MM;
export const PRINT_CONTENT_HEIGHT_PX = (297 - 15 - 18) * PX_PER_MM;

export type HeroBlock = {
  /** Height of the block (cover from the top of the document, or one day). */
  blockHeight: number;
  frameWidth: number;
  frameHeight: number;
  columnWidth: number;
};

/** New hero width in px, or null to leave the block as it is. */
export function fitHeroWidth(
  b: HeroBlock,
  { pageHeight = PRINT_CONTENT_HEIGHT_PX, slack = 24, minWidthRatio = 0.5 } = {},
): number | null {
  const over = b.blockHeight - (pageHeight - slack);
  if (over <= 0 || b.frameHeight <= 0 || b.frameWidth <= 0) return null;
  const width = Math.floor((b.frameHeight - over) * (b.frameWidth / b.frameHeight));
  if (width < b.columnWidth * minWidthRatio) return null;
  return width;
}
