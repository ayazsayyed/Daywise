import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

import { mockBrief } from "./mock";
import { systemPrompt } from "./prompts";
import { callStructured, type CallOptions } from "./providers";
import { briefSchema, describeIssues, type Brief } from "./schemas";

export class BriefError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BriefError";
  }
}

/**
 * Prompt → Brief with `assumed` listing the guessed fields. Hinglish and vague
 * prompts get Indian-market defaults (INR, couple, mid-range, relaxed).
 * Retries once with the validation issues when the model's object is off.
 */
export async function enhance(
  prompt: string,
  opts: CallOptions & { today?: Date } = {},
): Promise<Brief> {
  const clean = prompt.trim().replace(/\s+/g, " ").slice(0, 1_000);
  if (clean.length < 4) throw new BriefError("Describe the trip in a few words first.");

  if (env.MOCK_AI === "1") return briefSchema.parse(mockBrief(clean, opts.today));

  const today = (opts.today ?? new Date()).toISOString().slice(0, 10);
  const base = `Today's date: ${today}\n\nAgent's request:\n"""${clean}"""`;

  let feedback = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await callStructured(
      {
        op: "enhance",
        schema: briefSchema,
        system: systemPrompt("enhancer"),
        prompt: feedback
          ? `${base}\n\nYour previous answer had problems:\n${feedback}\nFix them.`
          : base,
        temperature: 0.2,
        maxOutputTokens: 2_000,
      },
      opts,
    );
    const parsed = briefSchema.safeParse(res.object);
    if (parsed.success) return parsed.data;
    feedback = describeIssues(parsed.error);
    logger.warn({ attempt, feedback }, "brief failed validation");
  }
  throw new BriefError(
    "We could not understand that request. Add the destination and number of days.",
  );
}
