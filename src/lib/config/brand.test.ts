import { describe, expect, it } from "vitest";

import { initialsOf, tenantSubdomain } from "./brand";

describe("initialsOf", () => {
  it("uses the first two words of an agency name", () => {
    expect(initialsOf("Shree Krishna Travel World")).toBe("SK");
    expect(initialsOf("Zara Tours")).toBe("ZT");
  });
  it("uses only the local part of an email", () => {
    expect(initialsOf("nikhil.joshi@shreekrishnatravelworld.com")).toBe("NJ");
    expect(initialsOf("ayaz@adfox.media")).toBe("AY");
  });
  it("falls back when there is nothing usable", () => {
    expect(initialsOf("   ", "A")).toBe("A");
  });
});

describe("tenantSubdomain", () => {
  it("reads <slug>.daywise.smallsoftware.in until the domain is bought", () => {
    expect(tenantSubdomain("sktw")).toBe("sktw.daywise.smallsoftware.in");
  });
});
