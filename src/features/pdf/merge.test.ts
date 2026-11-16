import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { mmToPt, pageLabel, stampPosition } from "./geometry";
import { mergeParts } from "./merge";

async function pdfWithPages(n: number): Promise<Uint8Array> {
  const d = await PDFDocument.create();
  for (let i = 0; i < n; i++) d.addPage([mmToPt(210), mmToPt(297)]);
  return d.save();
}

const font = () =>
  readFile(join(process.cwd(), "src/features/pdf/fonts/Inter-500.woff")).then(
    (b) => new Uint8Array(b),
  );

describe("page labels and stamp positions", () => {
  it("formats two digits minimum", () => {
    expect(pageLabel(2, 17)).toBe("Page 02 of 17");
    expect(pageLabel(9, 9)).toBe("Page 09 of 09");
    expect(pageLabel(12, 104)).toBe("Page 12 of 104");
  });

  it("places right, left and centre labels from the edges in points", () => {
    const W = mmToPt(210);
    const right = stampPosition({ align: "right", bottomMm: 5, sideMm: 16 }, 60, W);
    expect(right.x).toBeCloseTo(W - mmToPt(16) - 60, 5);
    expect(right.y).toBeCloseTo(mmToPt(5), 5);
    expect(stampPosition({ align: "left", bottomMm: 9, sideMm: 20 }, 60, W).x).toBeCloseTo(
      mmToPt(20),
      5,
    );
    expect(stampPosition({ align: "center", bottomMm: 9, sideMm: 0 }, 60, W).x).toBeCloseTo(
      (W - 60) / 2,
      5,
    );
    expect(right.size).toBe(9);
  });

  it("mm → pt", () => {
    expect(mmToPt(25.4)).toBeCloseTo(72, 6);
  });
});

describe("mergeParts", () => {
  it("keeps only the cover's first page, then body and last pages, in order", async () => {
    const { pdf, pages } = await mergeParts({
      cover: await pdfWithPages(2), // a stray second cover page is dropped
      body: await pdfWithPages(5),
      last: await pdfWithPages(1),
      stamp: { align: "right", bottomMm: 5, sideMm: 16, color: "#FFFFFF" },
      font: await font(),
    });
    expect(pages).toBe(7);
    expect((await PDFDocument.load(pdf)).getPageCount()).toBe(7);
  });

  it("stamps every page after the cover with the merged total", async () => {
    const { pdf } = await mergeParts({
      cover: await pdfWithPages(1),
      body: await pdfWithPages(3),
      last: await pdfWithPages(1),
      stamp: { align: "right", bottomMm: 5, sideMm: 16, color: "#1C1B19" },
      font: await font(),
    });
    const doc = await PDFDocument.load(pdf);
    const content = (i: number) =>
      doc.getPage(i).node.normalizedEntries().Contents?.toString() ?? "";
    expect(doc.getPageCount()).toBe(5);
    // Cover has no content stream added; later pages each gained one.
    expect(content(0)).toBe("");
    for (let i = 1; i < 5; i++) expect(content(i)).not.toBe("");
  });

  it("adds nothing when the style has no stamp", async () => {
    const { pdf } = await mergeParts({
      cover: await pdfWithPages(1),
      body: await pdfWithPages(2),
      last: await pdfWithPages(1),
      stamp: null,
      font: await font(),
    });
    const doc = await PDFDocument.load(pdf);
    expect(doc.getPages().every((p) => !p.node.normalizedEntries().Contents)).toBe(true);
  });
});
