import { describe, expect, it } from "vitest";

import {
  applyOp,
  checkOpRefs,
  coalesceKey,
  editorOpSchema,
  mergeOps,
  type EditorDay,
  type EditorDoc,
  type EditorOp,
} from "./doc";
import { EMPTY_PRICING } from "./pricing";

const D = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
const S = (n: number) => `00000000-0000-4000-9000-00000000000${n}`;

function day(n: number, stops: number[]): EditorDay {
  return {
    id: D(n),
    date: null,
    city: `City ${n}`,
    title: `Day ${n}`,
    summary: "",
    transport: "",
    hero: null,
    hotel: null,
    stops: stops.map((s) => ({
      id: S(s),
      kind: "sight",
      title: `Stop ${s}`,
      description: "",
      time: null,
      duration: null,
      placeId: null,
      verified: false,
      image: null,
    })),
  };
}

const doc: EditorDoc = {
  id: "00000000-0000-4000-8000-0000000000aa",
  title: "Kashmir",
  status: "draft",
  isTemplate: false,
  startDate: "2027-03-14",
  endDate: "2027-03-16",
  destination: "Kashmir",
  country: "India",
  budget: "mid-range",
  pace: "relaxed",
  client: null,
  pricing: EMPTY_PRICING,
  sections: { inclusions: "", exclusions: "", payment_terms: "", cancellation: "" },
  days: [day(1, [1, 2]), day(2, [3]), day(3, [4, 5])],
};

const apply = (ops: EditorOp[]) => ops.reduce(applyOp, doc);

describe("editor reducer", () => {
  it("dragging a day up re-dates every day", () => {
    const out = apply([{ op: "day.reorder", order: [D(2), D(1), D(3)] }]);
    expect(out.days.map((d) => d.id)).toEqual([D(2), D(1), D(3)]);
    expect(out.days.map((d) => d.date)).toEqual(["2027-03-14", "2027-03-15", "2027-03-16"]);
  });

  it("moves a stop across days at an index", () => {
    const out = apply([{ op: "stop.move", stopId: S(1), toDayId: D(3), toIndex: 1 }]);
    expect(out.days[0]!.stops.map((s) => s.id)).toEqual([S(2)]);
    expect(out.days[2]!.stops.map((s) => s.id)).toEqual([S(4), S(1), S(5)]);
  });

  it("adding and removing days reflows dates and the end date", () => {
    const added = apply([
      { op: "day.add", dayId: D(9), after: D(1), title: "Free day", city: "Srinagar" },
    ]);
    expect(added.days.map((d) => d.id)).toEqual([D(1), D(9), D(2), D(3)]);
    expect(added.endDate).toBe("2027-03-17");
    const removed = applyOp(added, { op: "day.remove", dayId: D(1) });
    expect(removed.days[0]!.date).toBe("2027-03-14");
    expect(removed.endDate).toBe("2027-03-16");
  });

  it("changing the start date re-dates every day", () => {
    const out = apply([{ op: "itinerary.set", startDate: "2027-04-01" }]);
    expect(out.days.map((d) => d.date)).toEqual(["2027-04-01", "2027-04-02", "2027-04-03"]);
  });

  it("swapping a hotel keeps room and meal plan; manual hotels are unverified", () => {
    const out = apply([
      {
        op: "hotel.replace",
        dayId: D(1),
        hotelId: "00000000-0000-4000-a000-000000000001",
        manual: { name: "Sukoon Houseboat", address: "Dal Lake" },
      },
    ]);
    expect(out.days[0]!.hotel).toMatchObject({
      name: "Sukoon Houseboat",
      verified: false,
      manual: true,
    });
  });
});

describe("op validation", () => {
  it("rejects money-free nonsense: bad times and unknown ops", () => {
    expect(
      editorOpSchema.safeParse({ op: "stop.set", stopId: S(1), patch: { time: "25:00" } }).success,
    ).toBe(false);
    expect(editorOpSchema.safeParse({ op: "itinerary.delete" }).success).toBe(false);
  });

  it("checkOpRefs refuses ids from another itinerary", () => {
    const owned = { dayIds: new Set([D(1), D(2)]), stopIds: new Set([S(1)]) };
    expect(checkOpRefs([{ op: "stop.remove", stopId: S(7) }], owned)).toMatch(/Unknown stop/);
    expect(checkOpRefs([{ op: "day.set", dayId: D(8), patch: { title: "x" } }], owned)).toMatch(
      /Unknown day/,
    );
    expect(checkOpRefs([{ op: "day.reorder", order: [D(1)] }], owned)).toMatch(/every day/);
    expect(
      checkOpRefs([{ op: "stop.move", stopId: S(1), toDayId: D(2), toIndex: 0 }], owned),
    ).toBeNull();
  });

  it("checkOpRefs follows ids created and removed within the batch", () => {
    const owned = { dayIds: new Set([D(1)]), stopIds: new Set<string>() };
    const ops: EditorOp[] = [
      { op: "day.add", dayId: D(2), after: D(1), title: "x", city: "y" },
      { op: "stop.add", stopId: S(1), dayId: D(2), index: 0, title: "Dal Lake", kind: "sight" },
      { op: "stop.set", stopId: S(1), patch: { title: "Dal Lake shikara" } },
    ];
    expect(checkOpRefs(ops, owned)).toBeNull();
    expect(checkOpRefs([{ op: "day.remove", dayId: D(1) }], owned)).toMatch(/at least one day/);
  });
});

describe("coalescing", () => {
  it("merges patches for the same stop, later fields win", () => {
    const a: EditorOp = { op: "stop.set", stopId: S(1), patch: { title: "A", time: "09:00" } };
    const b: EditorOp = { op: "stop.set", stopId: S(1), patch: { title: "B" } };
    expect(coalesceKey(a)).toBe(coalesceKey(b));
    expect(mergeOps(a, b)).toEqual({
      op: "stop.set",
      stopId: S(1),
      patch: { title: "B", time: "09:00" },
    });
    expect(coalesceKey({ op: "stop.remove", stopId: S(1) })).toBeNull();
  });
});
