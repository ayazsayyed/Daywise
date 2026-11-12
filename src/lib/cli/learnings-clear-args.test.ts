import { describe, expect, it } from "vitest";

import { parseClearArgs } from "./learnings-clear-args";

describe("learnings:clear args", () => {
  it("parses --tenant", () => {
    expect(parseClearArgs(["--tenant", "sktw"])).toEqual({ tenant: "sktw" });
    expect(parseClearArgs(["--", "--tenant=sktw"])).toEqual({ tenant: "sktw" });
  });
  it("parses an optional destination", () => {
    expect(parseClearArgs(["--tenant", "sktw", "--destination", "Kashmir"])).toEqual({
      tenant: "sktw",
      destination: "Kashmir",
    });
  });
  it("requires a tenant", () => {
    expect(() => parseClearArgs([])).toThrow(/--tenant/);
    expect(() => parseClearArgs(["--tenant"])).toThrow(/needs a value/);
    expect(() => parseClearArgs(["--bogus"])).toThrow(/Unknown/);
  });
});
