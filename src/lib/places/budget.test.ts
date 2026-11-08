import { describe, expect, it, vi } from "vitest";

import { createBudgetGuard } from "./budget";

function guard(
  used: { places_search: number; places_photo: number },
  caps = { places_search: 10, places_photo: 3 },
) {
  const record = vi.fn(async (kind: keyof typeof used, _t: string | null, units: number) => {
    used[kind] += units;
  });
  const alert = vi.fn(async () => {});
  const g = createBudgetGuard({
    caps,
    count: async (kind) => used[kind],
    record,
    alert,
    cacheMs: 0,
  });
  return { g, record, alert };
}

describe("places budget guard", () => {
  it("allows spending under the cap and records it", async () => {
    const used = { places_search: 0, places_photo: 0 };
    const { g, record } = guard(used);
    expect(await g.spend("places_search", "t1")).toBe(true);
    expect(record).toHaveBeenCalledWith("places_search", "t1", 1);
    expect((await g.state("places_search")).used).toBe(1);
  });

  it("refuses at the cap, alerts, and does not record", async () => {
    const used = { places_search: 10, places_photo: 2 };
    const { g, record, alert } = guard(used);
    expect(await g.spend("places_search", null)).toBe(false);
    expect(alert).toHaveBeenCalledWith("places_search", 10, 10);
    expect(record).not.toHaveBeenCalled();
    expect((await g.state("places_search")).exhausted).toBe(true);

    // The photo cap is separate and still has room for exactly one more.
    expect(await g.spend("places_photo", null)).toBe(true);
    expect(await g.spend("places_photo", null)).toBe(false);
  });

  it("trusts the cached count within the window and increments locally", async () => {
    const used = { places_search: 0, places_photo: 0 };
    let now = 1_000;
    const count = vi.fn(async () => used.places_search);
    const g = createBudgetGuard({
      caps: { places_search: 5, places_photo: 5 },
      count,
      record: async () => {},
      alert: async () => {},
      now: () => now,
      cacheMs: 60_000,
    });
    await g.spend("places_search", null);
    await g.spend("places_search", null);
    expect(count).toHaveBeenCalledTimes(1);
    expect((await g.state("places_search")).used).toBe(2);
    now += 61_000;
    await g.state("places_search");
    expect(count).toHaveBeenCalledTimes(2);
  });
});
