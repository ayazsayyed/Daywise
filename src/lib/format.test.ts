import { describe, expect, it } from "vitest";

import { formatDate, formatDateRange, formatNumber, relativeDay, startOfMonthIST } from "./format";

describe("format", () => {
  it("shows DD MMM YYYY in IST", () => {
    expect(formatDate("2027-03-14")).toBe("14 Mar 2027");
    // 18:30 UTC on 13 Mar is already 14 Mar in Kolkata.
    expect(formatDate(new Date("2027-03-13T18:30:00Z"))).toBe("14 Mar 2027");
  });
  it("collapses ranges", () => {
    expect(formatDateRange("2027-03-14", "2027-03-18")).toBe("14–18 Mar 2027");
    expect(formatDateRange("2026-12-28", "2027-01-02")).toBe("28 Dec 2026–2 Jan 2027");
    expect(formatDateRange("2026-11-28", "2026-12-02")).toBe("28 Nov–2 Dec 2026");
  });
  it("uses Indian grouping", () => {
    expect(formatNumber(184500)).toBe("1,84,500");
  });
  it("describes recency", () => {
    const now = new Date("2026-11-20T10:00:00Z");
    expect(relativeDay(new Date("2026-11-20T08:00:00Z"), now)).toBe("2 h ago");
    expect(relativeDay(new Date("2026-11-19T08:00:00Z"), now)).toBe("yesterday");
  });
  it("finds the start of the IST month", () => {
    expect(startOfMonthIST(new Date("2026-11-30T19:30:00Z")).toISOString()).toBe(
      "2026-11-30T18:30:00.000Z",
    );
  });
});

describe("editor date labels", () => {
  it("formats weekday ranges and clock times", async () => {
    const { formatWeekdayRange, formatWeekdayDate, formatClock } = await import("./format");
    expect(formatWeekdayRange("2027-03-14", "2027-03-18")).toBe("Sun 14 – Thu 18 Mar 2027");
    expect(formatWeekdayRange("2027-02-27", "2027-03-03")).toBe("Sat 27 Feb – Wed 3 Mar 2027");
    expect(formatWeekdayDate("2027-03-15")).toBe("Mon 15 Mar");
    expect(formatClock("12:30")).toBe("12:30 pm");
    expect(formatClock("00:05")).toBe("12:05 am");
    expect(formatClock("08:00")).toBe("8:00 am");
  });
});
