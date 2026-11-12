import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import {
  APICallError,
  generateObject,
  JSONParseError,
  NoObjectGeneratedError,
  RetryError,
  TypeValidationError,
  type LanguageModel,
} from "ai";
import type { z } from "zod";

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * The only module allowed to import AI providers (enforced by eslint).
 * Groq is primary, Gemini Flash the fallback; DeepSeek and Qwen are stubs
 * selectable by env. A call falls back automatically on 429, 5xx, network
 * errors and timeouts. Every call is reported through `onUsage` so the caller
 * can write a `usage_events` row.
 */
export type ProviderName = "groq" | "gemini" | "deepseek" | "qwen";

export type UsageReport = {
  provider: ProviderName;
  model: string;
  op: string;
  tokensIn: number;
  tokensOut: number;
  ms: number;
  ok: boolean;
};

export type StructuredCall<T> = {
  op: string;
  schema: z.ZodType<T>;
  system: string;
  prompt: string;
  temperature?: number;
  maxOutputTokens?: number;
  /** Set per provider by `callStructured` (e.g. Groq reasoning effort). */
  providerOptions?: Record<string, Record<string, string>>;
};

export type Runner = <T>(
  model: LanguageModel,
  call: StructuredCall<T>,
) => Promise<StructuredResult<T>>;

export type StructuredResult<T> = {
  object: T;
  tokensIn: number;
  tokensOut: number;
};

const DEFAULT_TIMEOUT_MS = 90_000;

type ResolvedModel = {
  model: LanguageModel;
  id: string;
  providerOptions?: Record<string, Record<string, string>>;
};

function modelFor(name: ProviderName): ResolvedModel {
  switch (name) {
    case "groq": {
      if (!env.GROQ_API_KEY) throw new ProviderNotConfigured("groq");
      const groq = createGroq({ apiKey: env.GROQ_API_KEY });
      return {
        model: groq(env.GROQ_MODEL),
        id: env.GROQ_MODEL,
        // gpt-oss reasons before answering; an itinerary needs little of it and "low" is much faster.
        providerOptions: { groq: { reasoningEffort: env.GROQ_REASONING_EFFORT } },
      };
    }
    case "gemini": {
      if (!env.GEMINI_API_KEY) throw new ProviderNotConfigured("gemini");
      const google = createGoogleGenerativeAI({ apiKey: env.GEMINI_API_KEY });
      return { model: google(env.GEMINI_MODEL), id: env.GEMINI_MODEL };
    }
    case "deepseek": {
      if (!env.DEEPSEEK_API_KEY) throw new ProviderNotConfigured("deepseek");
      const deepseek = createOpenAICompatible({
        name: "deepseek",
        baseURL: "https://api.deepseek.com/v1",
        apiKey: env.DEEPSEEK_API_KEY,
      });
      return { model: deepseek("deepseek-chat"), id: "deepseek-chat" };
    }
    case "qwen": {
      // Stub: Alibaba DashScope's OpenAI-compatible endpoint; key reuses DEEPSEEK slot until needed.
      if (!env.QWEN_API_KEY) throw new ProviderNotConfigured("qwen");
      const qwen = createOpenAICompatible({
        name: "qwen",
        baseURL: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
        apiKey: env.QWEN_API_KEY,
      });
      return { model: qwen("qwen-plus"), id: "qwen-plus" };
    }
  }
}

export class ProviderNotConfigured extends Error {
  constructor(public provider: ProviderName) {
    super(`AI provider ${provider} has no API key configured`);
    this.name = "ProviderNotConfigured";
  }
}

export class AIUnavailableError extends Error {
  constructor(
    message: string,
    public causes: unknown[],
  ) {
    super(message);
    this.name = "AIUnavailableError";
  }
}

/** The AI SDK wraps its own retries in RetryError; judge the last underlying error. */
export function unwrapError(err: unknown): unknown {
  return RetryError.isInstance(err) ? (err.lastError ?? err) : err;
}

/** True for the failures that justify trying the next provider. */
export function shouldFallback(e: unknown): boolean {
  const err = unwrapError(e);
  if (err instanceof ProviderNotConfigured) return true;
  if (err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError"))
    return true;
  if (APICallError.isInstance(err)) {
    const s = err.statusCode;
    if (s === 429 || (s !== undefined && s >= 500)) return true;
    // Bad or revoked key / no access to the model: this provider cannot answer, the next one may.
    if (s === 401 || s === 403) return true;
    if (s === undefined) return true; // network / DNS / reset
    return err.isRetryable;
  }
  const code = (err as { code?: string })?.code;
  return ["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN"].includes(code ?? "");
}

/**
 * True when the model answered but its JSON was rejected — by the SDK's own
 * zod check (NoObjectGeneratedError / TypeValidationError / JSONParseError) or
 * by the provider's structured-output validator (Groq: 400 "Generated JSON does
 * not match the expected schema"). Callers retry once with this message as
 * feedback; it is not a reason to switch providers.
 */
export function isSchemaRejection(e: unknown): boolean {
  const err = unwrapError(e);
  if (
    NoObjectGeneratedError.isInstance(err) ||
    TypeValidationError.isInstance(err) ||
    JSONParseError.isInstance(err)
  )
    return true;
  if (APICallError.isInstance(err) && err.statusCode === 400) {
    const text = `${err.message} ${err.responseBody ?? ""}`;
    return /does not match the expected schema|json_validate_failed|failed to (generate|validate) json|schema/i.test(
      text,
    );
  }
  return false;
}

/** Short, model-readable reason for a schema rejection (used as retry feedback). */
export function schemaRejectionFeedback(e: unknown): string {
  const err = unwrapError(e);
  if (TypeValidationError.isInstance(err) || NoObjectGeneratedError.isInstance(err)) {
    const cause = (err as { cause?: unknown }).cause;
    const msg = cause instanceof Error ? cause.message : (err as Error).message;
    return msg.slice(0, 1_500);
  }
  if (APICallError.isInstance(err))
    return `${err.message} ${err.responseBody ?? ""}`.slice(0, 1_500);
  return err instanceof Error ? err.message.slice(0, 1_500) : String(err).slice(0, 1_500);
}

/** Default runner: Vercel AI SDK `generateObject`. */
export const sdkRunner: Runner = async (model, call) => {
  const result = await generateObject({
    model,
    schema: call.schema,
    system: call.system,
    prompt: call.prompt,
    temperature: call.temperature ?? 0.4,
    maxOutputTokens: call.maxOutputTokens ?? 8_000,
    ...(call.providerOptions ? { providerOptions: call.providerOptions } : {}),
    abortSignal: AbortSignal.timeout(env.AI_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS),
  });
  return {
    object: result.object,
    tokensIn: result.usage.inputTokens ?? 0,
    tokensOut: result.usage.outputTokens ?? 0,
  };
};

export type CallOptions = {
  /** Ordered provider chain; defaults to [AI_PROVIDER, AI_FALLBACK_PROVIDER]. */
  chain?: ProviderName[];
  onUsage?: (u: UsageReport) => void | Promise<void>;
  /** Injected for tests. */
  runner?: Runner;
  resolveModel?: (name: ProviderName) => ResolvedModel;
};

/**
 * Runs one structured call through the provider chain. Schema validation
 * failures are NOT a reason to fall back (the model answered; the caller
 * retries with feedback) — only transport/quota failures are.
 */
export async function callStructured<T>(
  call: StructuredCall<T>,
  opts: CallOptions = {},
): Promise<StructuredResult<T> & { provider: ProviderName; model: string }> {
  const chain = dedupe(opts.chain ?? [env.AI_PROVIDER, env.AI_FALLBACK_PROVIDER]);
  const runner = opts.runner ?? sdkRunner;
  const resolve = opts.resolveModel ?? modelFor;
  const causes: unknown[] = [];

  for (const name of chain) {
    const started = Date.now();
    let id = name;
    try {
      const { model, id: modelId, providerOptions } = resolve(name);
      id = modelId as ProviderName;
      const res = await runner(model, providerOptions ? { ...call, providerOptions } : call);
      await opts.onUsage?.({
        provider: name,
        model: modelId,
        op: call.op,
        tokensIn: res.tokensIn,
        tokensOut: res.tokensOut,
        ms: Date.now() - started,
        ok: true,
      });
      return { ...res, provider: name, model: modelId };
    } catch (err) {
      causes.push(err);
      if (!(err instanceof ProviderNotConfigured)) {
        await opts.onUsage?.({
          provider: name,
          model: id,
          op: call.op,
          tokensIn: 0,
          tokensOut: 0,
          ms: Date.now() - started,
          ok: false,
        });
      }
      if (shouldFallback(err)) {
        logger.warn(
          { provider: name, op: call.op, err: errorSummary(err) },
          "AI provider failed; trying next",
        );
        continue;
      }
      throw err;
    }
  }
  throw new AIUnavailableError(
    "The AI service is unavailable right now. Please try again in a minute.",
    causes,
  );
}

/**
 * Chain for the one retry after the provider itself rejected its JSON: ask the
 * fallback first (a different model is likelier to succeed), then the primary.
 */
export function retryChain(opts: CallOptions): ProviderName[] {
  if (opts.chain) return opts.chain;
  return dedupe([env.AI_FALLBACK_PROVIDER, env.AI_PROVIDER]);
}

function dedupe<T>(xs: T[]): T[] {
  return xs.filter((x, i) => xs.indexOf(x) === i);
}

export function errorSummary(e: unknown): string {
  const err = unwrapError(e);
  if (APICallError.isInstance(err))
    return `${err.statusCode ?? "net"} ${err.message.slice(0, 200)}`;
  if (err instanceof Error) return `${err.name}: ${err.message.slice(0, 200)}`;
  return String(err).slice(0, 200);
}
