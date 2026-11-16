import { describe, expect, it } from "vitest";

import { componentsFor } from "./index";
import {
  assignableStyleIds,
  BUILT_IN_META,
  canUseStyle,
  EDITORIAL,
  HERITAGE,
  resolveStyleMeta,
  stylesForTenant,
  type Registry,
} from "./meta";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const bespoke = { ...HERITAGE, id: "sktw-2026", name: "SKTW 2026" };
const reg: Registry = {
  builtIn: BUILT_IN_META,
  bespoke: { "sktw-2026": { meta: bespoke, tenantIds: [A] } },
};

describe("style registry gating", () => {
  it("ships the four built-in styles, Editorial as the default", () => {
    expect(BUILT_IN_META.map((s) => s.id)).toEqual([
      "editorial",
      "heritage",
      "photo-first",
      "minimal",
    ]);
    expect(EDITORIAL.singleDocument).toBe(true);
    expect(BUILT_IN_META.filter((s) => s.supportsBackdrop).map((s) => s.id)).toEqual(["heritage"]);
  });

  it("every built-in style has components", () => {
    for (const s of BUILT_IN_META) expect(componentsFor(s), s.id).toBeDefined();
  });

  it("a bespoke style is selectable only by the tenant that owns it", () => {
    expect(stylesForTenant(A, reg).map((s) => s.id)).toContain("sktw-2026");
    expect(stylesForTenant(B, reg).map((s) => s.id)).not.toContain("sktw-2026");
    expect(canUseStyle("sktw-2026", A, reg)).toBe(true);
    expect(canUseStyle("sktw-2026", B, reg)).toBe(false);
    expect(assignableStyleIds(B, reg)).toEqual(["editorial", "heritage", "photo-first", "minimal"]);
  });

  it("unknown or unowned ids render as Editorial, never fail", () => {
    expect(resolveStyleMeta("sktw-2026", B, reg).id).toBe("editorial");
    expect(resolveStyleMeta("nope", A, reg).id).toBe("editorial");
    expect(resolveStyleMeta(null, A, reg).id).toBe("editorial");
    expect(resolveStyleMeta("heritage", B, reg).id).toBe("heritage");
    expect(resolveStyleMeta("sktw-2026", A, reg).id).toBe("sktw-2026");
  });

  it("insets leave a usable body on every style", () => {
    for (const s of BUILT_IN_META) {
      expect(210 - s.insets.left - s.insets.right).toBeGreaterThanOrEqual(160);
      expect(297 - s.insets.top - s.insets.bottom).toBeGreaterThanOrEqual(220);
    }
  });
});
