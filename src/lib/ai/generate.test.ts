import { APICallError, NoObjectGeneratedError } from "ai";
import { describe, expect, it, vi } from "vitest";

import { generate, GenerationError } from "./generate";
import { mockBrief, mockItinerary } from "./mock";
import { isSchemaRejection, type Runner } from "./providers";

const brief = mockBrief("5-day Kashmir couple mid-range", new Date("2026-11-08T00:00:00Z"));
const golden = mockItinerary(brief);
const fakeModel = (name: string) => ({ model: { modelId: name } as never, id: `${name}-model` });

/** Groq's structured-output rejection from issue #10. */
function groqSchemaError() {
  return new APICallError({
    message: "Generated JSON does not match the expected schema. Please adjust your prompt.",
    url: "https://api.groq.com/openai/v1/chat/completions",
    requestBodyValues: {},
    statusCode: 400,
    responseBody:
      '{"error":{"message":"jsonschema: \'/days/4/stops\' does not validate: minItems: got 0, want 1","code":"json_validate_failed"}}',
    isRetryable: false,
  });
}

describe("schema rejections (#10)", () => {
  it("recognises provider-side and SDK-side schema rejections only", () => {
    expect(isSchemaRejection(groqSchemaError())).toBe(true);
    expect(
      isSchemaRejection(
        new NoObjectGeneratedError({
          message: "No object generated: response did not match schema.",
          text: "{}",
          response: { id: "x", timestamp: new Date(), modelId: "m" },
          usage: {} as never,
          finishReason: "stop",
        }),
      ),
    ).toBe(true);
    const auth = new APICallError({
      message: "Invalid API Key",
      url: "u",
      requestBodyValues: {},
      statusCode: 401,
      isRetryable: false,
    });
    expect(isSchemaRejection(auth)).toBe(false);
  });

  it("retries once with the provider's error as feedback, then succeeds", async () => {
    const prompts: string[] = [];
    const runner = vi.fn(async (_m: unknown, call: { prompt: string }) => {
      prompts.push(call.prompt);
      if (prompts.length === 1) throw groqSchemaError();
      return { object: golden, tokensIn: 1, tokensOut: 1 };
    }) as unknown as Runner;

    const out = await generate(brief, undefined, {
      chain: ["groq"],
      runner,
      resolveModel: fakeModel,
    });
    expect(out.days).toHaveLength(5);
    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toMatch(/previous draft was rejected/);
    expect(prompts[1]).toMatch(/minItems: got 0/);
  });

  it("fails with a readable GenerationError after the retry", async () => {
    const runner = vi.fn(async () => {
      throw groqSchemaError();
    }) as unknown as Runner;
    await expect(
      generate(brief, undefined, { chain: ["groq"], runner, resolveModel: fakeModel }),
    ).rejects.toBeInstanceOf(GenerationError);
    expect(runner).toHaveBeenCalledTimes(2);
  });

  it("does not swallow non-schema errors", async () => {
    const runner = vi.fn(async () => {
      throw new APICallError({
        message: "Please reduce the length of the messages or completion.",
        url: "u",
        requestBodyValues: {},
        statusCode: 400,
        isRetryable: false,
      });
    }) as unknown as Runner;
    await expect(
      generate(brief, undefined, { chain: ["groq"], runner, resolveModel: fakeModel }),
    ).rejects.toBeInstanceOf(APICallError);
    expect(runner).toHaveBeenCalledTimes(1);
  });
});
