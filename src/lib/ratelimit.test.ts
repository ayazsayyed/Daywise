import { describe, expect, it } from "vitest";

import { createLimiter, ipFrom, RULES } from "./ratelimit";

describe("rate limiter", () => {
  it("allows the limit, then refuses until the window passes", () => {
    const l = createLimiter();
    const rule = { limit: 3, windowMs: 1000 };
    expect([1, 2, 3].map(() => l.hit("k", rule, 0).ok)).toEqual([true, true, true]);
    const blocked = l.hit("k", rule, 500);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBe(1);
    expect(l.hit("k", rule, 1000).ok).toBe(true);
  });

  it("keys are independent", () => {
    const l = createLimiter();
    const rule = { limit: 1, windowMs: 1000 };
    expect(l.hit("a", rule, 0).ok).toBe(true);
    expect(l.hit("b", rule, 0).ok).toBe(true);
    expect(l.hit("a", rule, 0).ok).toBe(false);
  });

  it("login is 5 per 15 minutes per email; share page 60 per minute", () => {
    const l = createLimiter();
    const results = Array.from({ length: 6 }, () => l.hit("e", RULES.loginEmail, 0).ok);
    expect(results).toEqual([true, true, true, true, true, false]);
    expect(l.hit("e", RULES.loginEmail, 15 * 60_000).ok).toBe(true);
    const page = Array.from({ length: 61 }, () => l.hit("ip", RULES.sharePage, 0).ok);
    expect(page.filter(Boolean)).toHaveLength(60);
  });

  it("sweeps expired windows when full", () => {
    const l = createLimiter(2);
    const rule = { limit: 5, windowMs: 100 };
    l.hit("a", rule, 0);
    l.hit("b", rule, 0);
    l.hit("c", rule, 200);
    expect(l.size()).toBe(1);
  });

  it("reads the client ip from x-forwarded-for", () => {
    expect(ipFrom(new Headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }))).toBe("1.2.3.4");
    expect(ipFrom(new Headers({ "x-real-ip": "5.6.7.8" }))).toBe("5.6.7.8");
    expect(ipFrom(new Headers())).toBe("unknown");
  });
});
