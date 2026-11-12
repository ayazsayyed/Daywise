import { describe, expect, it } from "vitest";

import { shouldRecordLearning } from "./learning-policy";

describe("shouldRecordLearning (#14)", () => {
  it("records nothing in mock mode", () => {
    expect(shouldRecordLearning({ kind: "hotel_swap", placeId: "ChIJabc" }, { mockAi: true })).toBe(
      false,
    );
    expect(shouldRecordLearning({ kind: "stop_added" }, { mockAi: true })).toBe(false);
  });

  it("records a swap to a real Places hotel", () => {
    expect(
      shouldRecordLearning({ kind: "hotel_swap", placeId: "ChIJabc" }, { mockAi: false }),
    ).toBe(true);
  });

  it("skips a manual hotel (no place_id)", () => {
    expect(shouldRecordLearning({ kind: "hotel_swap", placeId: null }, { mockAi: false })).toBe(
      false,
    );
    expect(shouldRecordLearning({ kind: "hotel_swap", placeId: " " }, { mockAi: false })).toBe(
      false,
    );
  });

  it("records manual stop additions outside mock mode", () => {
    expect(shouldRecordLearning({ kind: "stop_added" }, { mockAi: false })).toBe(true);
  });
});
