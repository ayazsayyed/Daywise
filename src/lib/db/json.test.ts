import { describe, expect, it } from "vitest";

import {
  tenantBrandingSchema,
  tenantDefaultsSchema,
  DEFAULT_BRANDING,
  DEFAULT_DEFAULTS,
} from "./json";

describe("tenant json schemas", () => {
  it("accepts the defaults", () => {
    expect(tenantBrandingSchema.parse(DEFAULT_BRANDING)).toEqual(DEFAULT_BRANDING);
    expect(tenantDefaultsSchema.parse(DEFAULT_DEFAULTS)).toEqual(DEFAULT_DEFAULTS);
  });

  it("rejects a non-hex theme colour", () => {
    expect(() => tenantBrandingSchema.parse({ ...DEFAULT_BRANDING, theme_color: "red" })).toThrow();
    expect(() =>
      tenantBrandingSchema.parse({ ...DEFAULT_BRANDING, theme_color: "#FFF" }),
    ).toThrow();
  });

  it("rejects a malformed email but allows empty", () => {
    expect(() => tenantBrandingSchema.parse({ ...DEFAULT_BRANDING, email: "nope" })).toThrow();
    expect(tenantBrandingSchema.parse({ ...DEFAULT_BRANDING, email: "" }).email).toBe("");
  });
});
