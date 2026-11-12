import { existsSync } from "node:fs";
import { join } from "node:path";

import { config } from "dotenv";

/**
 * Loads env files for scripts and the worker with the same precedence Next.js
 * uses: **shell > `.env.local` > `.env`**. Neither file overrides a variable
 * that is already set, so `MOCK_AI=1 pnpm gen …` wins over `MOCK_AI=0` in
 * `.env.local`. (Next loads its own env files with this order; nothing to
 * change there.)
 */
export function loadEnvFiles(
  cwd: string = process.cwd(),
  target: Record<string, string | undefined> = process.env,
): void {
  for (const file of [".env.local", ".env"]) {
    const path = join(cwd, file);
    if (!existsSync(path)) continue;
    config({ path, override: false, quiet: true, processEnv: target as Record<string, string> });
  }
}
