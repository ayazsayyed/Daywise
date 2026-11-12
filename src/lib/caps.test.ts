import { describe, expect, it } from "vitest";

import { capMessage } from "./caps";
import { startOfDayIST } from "./format";

const base = { generationsToday: 0, dailyGenCap: 30, aiCallsThisMonth: 0, monthlyAiCap: 600 };

describe("capMessage", () => {
  it("allows under both caps", () => {
    expect(capMessage(base)).toBeNull();
    expect(capMessage({ ...base, generationsToday: 29, aiCallsThisMonth: 599 })).toBeNull();
  });
  it("refuses at the daily generation cap", () => {
    expect(capMessage({ ...base, generationsToday: 30 })).toMatch(/Today's limit of 30/);
  });
  it("refuses at the monthly AI cap", () => {
    expect(capMessage({ ...base, aiCallsThisMonth: 600 })).toMatch(/AI limit \(600 calls\)/);
  });
  it("a zero cap blocks everything", () => {
    expect(capMessage({ ...base, dailyGenCap: 0 })).not.toBeNull();
  });
});

describe("startOfDayIST", () => {
  it("is midnight in Kolkata", () => {
    // 12 Nov 2026 20:00 UTC = 13 Nov 01:30 IST → 12 Nov 18:30 UTC.
    expect(startOfDayIST(new Date("2026-11-12T20:00:00Z")).toISOString()).toBe(
      "2026-11-12T18:30:00.000Z",
    );
    expect(startOfDayIST(new Date("2026-11-12T10:00:00Z")).toISOString()).toBe(
      "2026-11-11T18:30:00.000Z",
    );
  });
});
