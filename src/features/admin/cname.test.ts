import { describe, expect, it } from "vitest";

import { cnameVerdict, RESERVED_SLUGS, SLUG_RE } from "./cname";

const base = {
  expectedTargets: ["sktw.daywise.smallsoftware.in", "daywise.smallsoftware.in"],
  appIps: ["200.141.14.237"],
  cnames: [] as string[],
  aRecords: [] as string[],
};

describe("cnameVerdict", () => {
  it("accepts a CNAME to the tenant subdomain (trailing dot, case)", () => {
    expect(cnameVerdict({ ...base, cnames: ["SKTW.daywise.smallsoftware.in."] }).ok).toBe(true);
  });
  it("rejects a CNAME elsewhere and names the expected target", () => {
    const v = cnameVerdict({ ...base, cnames: ["ghs.googlehosted.com"] });
    expect(v.ok).toBe(false);
    expect(v.summary).toContain("sktw.daywise.smallsoftware.in");
  });
  it("accepts apex A records equal to the app IPs", () => {
    expect(cnameVerdict({ ...base, aRecords: ["200.141.14.237"] }).ok).toBe(true);
  });
  it("rejects other A records and missing DNS", () => {
    expect(cnameVerdict({ ...base, aRecords: ["1.2.3.4"] }).ok).toBe(false);
    expect(cnameVerdict(base).summary).toMatch(/No CNAME or A record/);
  });
});

describe("slugs", () => {
  it("allows short lowercase slugs, refuses odd ones", () => {
    expect(SLUG_RE.test("sktw")).toBe(true);
    expect(SLUG_RE.test("gupta-travels")).toBe(true);
    expect(SLUG_RE.test("-x")).toBe(false);
    expect(SLUG_RE.test("Upper")).toBe(false);
    expect(SLUG_RE.test("a.b")).toBe(false);
    expect(RESERVED_SLUGS.has("admin")).toBe(true);
  });
});
