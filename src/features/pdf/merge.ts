import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb } from "pdf-lib";

import { pageLabel, stampPosition, type StampSpec } from "./geometry";

/**
 * Generated-style PDF assembly: cover (first page only) + body + last, then
 * "Page 02 of 17" on every page after the cover, after the merge so the total
 * is right. pdf-lib copies each part's pages with their shared resources, so
 * an image used on many pages stays one object per part.
 */

export type ResolvedStamp = Omit<StampSpec, "color"> & { color: string };

const hexRgb = (hex: string) => {
  const n = parseInt(hex.replace("#", ""), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};

export async function mergeParts(input: {
  cover: Uint8Array;
  body: Uint8Array;
  last: Uint8Array;
  stamp: ResolvedStamp | null;
  /** Inter (woff) for the stamp, so numbers match the page type. */
  font: Uint8Array;
}): Promise<{ pdf: Uint8Array; pages: number }> {
  const out = await PDFDocument.create();
  out.registerFontkit(fontkit);

  const cover = await PDFDocument.load(input.cover);
  const [first] = await out.copyPages(cover, [0]);
  out.addPage(first!);
  for (const part of [input.body, input.last]) {
    const doc = await PDFDocument.load(part);
    const pages = await out.copyPages(doc, doc.getPageIndices());
    for (const p of pages) out.addPage(p);
  }

  const total = out.getPageCount();
  if (input.stamp && total > 1) {
    const font = await out.embedFont(input.font, { subset: true });
    const color = hexRgb(input.stamp.color);
    out.getPages().forEach((page, i) => {
      if (i === 0) return; // never on the cover
      const label =
        input.stamp!.format === "short" ? String(i + 1).padStart(2, "0") : pageLabel(i + 1, total);
      const width = font.widthOfTextAtSize(label, 9);
      const pos = stampPosition(input.stamp!, width, page.getWidth());
      page.drawText(label, { x: pos.x, y: pos.y, size: pos.size, font, color });
    });
  }

  out.setProducer("");
  out.setCreator("");
  const pdf = await out.save({ useObjectStreams: true });
  return { pdf, pages: total };
}
