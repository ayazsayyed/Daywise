import { describe, expect, it } from "vitest";

import { opsToken, validOpsToken } from "./token";

const SECRET = "x".repeat(40);

describe("ops token", () => {
  it("accepts the token for its own purpose only", () => {
    const t = opsToken("sentry-test", SECRET);
    expect(validOpsToken("sentry-test", t, SECRET)).toBe(true);
    expect(validOpsToken("other", t, SECRET)).toBe(false);
    expect(validOpsToken("sentry-test", t, "y".repeat(40))).toBe(false);
    expect(validOpsToken("sentry-test", null, SECRET)).toBe(false);
    expect(validOpsToken("sentry-test", "short", SECRET)).toBe(false);
  });
});
