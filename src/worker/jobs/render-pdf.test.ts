import { describe, expect, it } from "vitest";

import { countPdfPages } from "./render-pdf";

describe("countPdfPages", () => {
  it("counts page objects, not the page tree", () => {
    const pdf = Buffer.from(
      "%PDF-1.7\n1 0 obj <</Type /Pages /Count 2>> endobj 2 0 obj <</Type /Page>> endobj 3 0 obj <</Type/Page /Parent 1 0 R>> endobj",
      "latin1",
    );
    expect(countPdfPages(pdf)).toBe(2);
  });
});
