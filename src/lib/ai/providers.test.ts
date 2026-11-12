import { APICallError } from "ai";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  AIUnavailableError,
  callStructured,
  ProviderNotConfigured,
  shouldFallback,
  type ProviderName,
  type Runner,
  type UsageReport,
} from "./providers";

const schema = z.object({ ok: z.boolean() });
const call = { op: "test", schema, system: "s", prompt: "p" };

function apiError(statusCode: number | undefined, isRetryable = false) {
  return new APICallError({
    message: `http ${statusCode}`,
    url: "https://example.test",
    requestBodyValues: {},
    statusCode,
    isRetryable,
  });
}

const fakeModel = (name: string) => ({ model: { modelId: name } as never, id: `${name}-model` });

describe("provider fallback", () => {
  it("falls back from Groq to Gemini on 429 and reports both calls", async () => {
    const usage: UsageReport[] = [];
    const runner: Runner = vi.fn(async (model: { modelId?: string }) => {
      if (model.modelId === "groq") throw apiError(429);
      return { object: { ok: true }, tokensIn: 10, tokensOut: 5 };
    }) as unknown as Runner;

    const res = await callStructured(call, {
      chain: ["groq", "gemini"],
      runner,
      resolveModel: fakeModel,
      onUsage: (u) => void usage.push(u),
    });
    expect(res.provider).toBe("gemini");
    expect(res.object).toEqual({ ok: true });
    expect(usage.map((u) => [u.provider, u.ok])).toEqual([
      ["groq", false],
      ["gemini", true],
    ]);
  });

  it("falls back on a bad or unauthorised key (401/403)", async () => {
    expect(shouldFallback(apiError(401))).toBe(true);
    expect(shouldFallback(apiError(403))).toBe(true);
    expect(shouldFallback(apiError(400))).toBe(false);
    const runner: Runner = vi.fn(async (model: { modelId?: string }) => {
      if (model.modelId === "groq") throw apiError(401);
      return { object: { ok: true }, tokensIn: 1, tokensOut: 1 };
    }) as unknown as Runner;
    const res = await callStructured(call, {
      chain: ["groq", "gemini"],
      runner,
      resolveModel: fakeModel,
    });
    expect(res.provider).toBe("gemini");
  });

  it("falls back on 5xx, timeouts and network errors", () => {
    expect(shouldFallback(apiError(503))).toBe(true);
    expect(shouldFallback(apiError(undefined))).toBe(true);
    const timeout = new Error("t");
    timeout.name = "TimeoutError";
    expect(shouldFallback(timeout)).toBe(true);
    expect(shouldFallback(Object.assign(new Error("x"), { code: "ECONNRESET" }))).toBe(true);
  });

  // A 400 is our request's fault and would fail the same way everywhere. (401/403 do fall
  // back: Day 2 acceptance requires a bad Groq key to land on Gemini.)
  it("does not fall back on a 400 — that is our bug, not capacity", async () => {
    const runner: Runner = vi.fn(async () => {
      throw apiError(400);
    }) as unknown as Runner;
    await expect(
      callStructured(call, { chain: ["groq", "gemini"], runner, resolveModel: fakeModel }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(runner).toHaveBeenCalledTimes(1);
  });

  it("skips providers without a key and fails readably when all are down", async () => {
    const runner: Runner = vi.fn(async () => {
      throw apiError(500);
    }) as unknown as Runner;
    const resolve = (name: ProviderName) => {
      if (name === "groq") throw new ProviderNotConfigured(name);
      return fakeModel(name);
    };
    const p = callStructured(call, { chain: ["groq", "gemini"], runner, resolveModel: resolve });
    await expect(p).rejects.toBeInstanceOf(AIUnavailableError);
    await expect(p).rejects.toThrow(/unavailable right now/);
  });
});
