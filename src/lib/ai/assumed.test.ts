import { describe, expect, it } from "vitest";

import { reconcileAssumed } from "./assumed";
import { enhance } from "./enhance";
import { mockBrief } from "./mock";

const today = new Date("2026-11-08T00:00:00Z");
const ALLOWED = ["start_date", "cities", "entry_city", "exit_city", "must_sees", "season", "pace"];

describe("assumed fields (#11)", () => {
  it("drops stated fields from the list in the bug report", () => {
    const prompt = "5-day Kashmir couple mid-range";
    const brief = {
      ...mockBrief(prompt, today),
      // What gpt-oss-120b actually returned.
      assumed: ["nights", "start_date", "budget", "pace", "pax", "cities", "currency", "country"],
    };
    const out = reconcileAssumed(prompt, brief);
    expect(out.every((f) => ALLOWED.includes(f))).toBe(true);
    expect(out).not.toContain("nights");
    expect(out).not.toContain("budget");
    expect(out).not.toContain("pax");
    expect(out).toContain("start_date");
  });

  it("enhance() returns assumed ⊆ the allowed set for that prompt", async () => {
    const b = await enhance("5-day Kashmir couple mid-range", { today });
    expect(b.assumed.every((f) => ALLOWED.includes(f))).toBe(true);
  });

  it("keeps genuinely guessed fields", () => {
    const prompt = "Kerala honeymoon";
    const brief = {
      ...mockBrief(prompt, today),
      assumed: ["nights", "budget", "pax", "pax.adults"],
    };
    expect(reconcileAssumed(prompt, brief)).toEqual(["nights", "budget"]);
  });

  it("reads Hinglish and 5D4N shorthand", () => {
    const b = { ...mockBrief("kashmir", today), assumed: ["nights", "budget", "pace"] };
    expect(reconcileAssumed("kashmir 5D4N sasta aaram se", b)).toEqual([]);
    expect(reconcileAssumed("kashmir 5 din", b)).toEqual(["budget", "pace"]);
  });

  it("family of 4 without ages keeps pax assumed (the adult/child split is a guess)", () => {
    const b = { ...mockBrief("Dubai 4 days family of 4", today), assumed: ["pax"] };
    expect(reconcileAssumed("Dubai 4 days family of 4", b)).toEqual(["pax"]);
  });
});
