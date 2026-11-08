import { describe, expect, it } from "vitest";

import {
  generateToken,
  hashLoginToken,
  hashSessionToken,
  normaliseEmail,
  safeEqual,
  LOGIN_TOKEN_TTL_MS,
  SESSION_TTL_MS,
} from "./tokens";

describe("auth tokens", () => {
  it("generates unguessable tokens of 24+ chars", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(24);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("hashes deterministically", () => {
    expect(hashLoginToken("abc")).toBe(hashLoginToken("abc"));
    expect(hashLoginToken("abc")).not.toBe(hashLoginToken("abd"));
    expect(hashSessionToken("abc", "s1")).not.toBe(hashSessionToken("abc", "s2"));
  });

  it("compares safely", () => {
    expect(safeEqual("x", "x")).toBe(true);
    expect(safeEqual("x", "y")).toBe(false);
    expect(safeEqual("x", "xy")).toBe(false);
  });

  it("normalises email", () => {
    expect(normaliseEmail("  Ayaz@AdFox.Media ")).toBe("ayaz@adfox.media");
  });

  it("uses the contract TTLs", () => {
    expect(LOGIN_TOKEN_TTL_MS).toBe(15 * 60 * 1000);
    expect(SESSION_TTL_MS).toBe(30 * 24 * 60 * 60 * 1000);
  });
});
