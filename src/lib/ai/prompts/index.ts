import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * System prompts live as markdown next to this file so they can be reviewed
 * like copy. They are read once per process. Both include the hard rule that
 * the AI never invents money, availability or star ratings.
 */
const cache = new Map<string, string>();

export type PromptName = "itinerary" | "enhancer";

export function systemPrompt(name: PromptName): string {
  const cached = cache.get(name);
  if (cached) return cached;
  const text = readFileSync(join(process.cwd(), "src/lib/ai/prompts", `${name}.md`), "utf8");
  if (!/never state money|never invents?|never state prices/i.test(text)) {
    throw new Error(`Prompt ${name} is missing the no-money rule`);
  }
  cache.set(name, text);
  return text;
}
