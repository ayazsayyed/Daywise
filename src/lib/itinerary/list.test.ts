import { describe, expect, it } from "vitest";

import { countByStatus, matchesQuery, parseTab, sortRows, summaryLine, type ListRow } from "./list";

const row = (p: Partial<ListRow>): ListRow => ({
  id: Math.random().toString(36),
  title: "Kashmir for Ananya & Rohit",
  status: "draft",
  clientName: "Ananya & Rohit Kapoor",
  destination: "Kashmir",
  cities: ["Srinagar", "Gulmarg"],
  startDate: "2027-03-14",
  updatedAt: new Date("2026-11-10T10:00:00Z"),
  lastViewedAt: null,
  ...p,
});

describe("dashboard list", () => {
  it("searches client, destination and city, case-insensitive", () => {
    const r = row({});
    expect(matchesQuery(r, "kapoor")).toBe(true);
    expect(matchesQuery(r, "GULMARG")).toBe(true);
    expect(matchesQuery(r, "dubai")).toBe(false);
    expect(matchesQuery(r, "  ")).toBe(true);
  });

  it("counts tabs and writes the summary line", () => {
    const now = new Date("2026-11-12T06:00:00Z");
    const rows = [
      row({ status: "sent", lastViewedAt: new Date("2026-11-12T02:00:00Z") }),
      row({ status: "sent" }),
      row({ status: "confirmed" }),
      row({ status: "lost" }),
    ];
    expect(countByStatus(rows)).toEqual({ all: 4, draft: 0, sent: 2, confirmed: 1, lost: 1 });
    expect(summaryLine(rows, now)).toBe(
      "4 itineraries · 2 waiting on a client reply · 1 viewed today",
    );
  });

  it("sorts by trip date with undated last, and by last viewed", () => {
    const a = row({ id: "a", startDate: "2027-05-01" });
    const b = row({ id: "b", startDate: null });
    const c = row({ id: "c", startDate: "2026-12-22", lastViewedAt: new Date() });
    expect(sortRows([a, b, c], "dates").map((r) => r.id)).toEqual(["c", "a", "b"]);
    expect(sortRows([a, b, c], "viewed")[0]!.id).toBe("c");
  });

  it("falls back to the all tab on junk", () => {
    expect(parseTab("drop table")).toBe("all");
    expect(parseTab("templates")).toBe("templates");
  });
});
