import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { loadEnvFiles } from "./env-files";

describe("loadEnvFiles precedence (shell > .env.local > .env)", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "daywise-env-"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("never overrides a variable set in the shell", () => {
    writeFileSync(join(dir, ".env"), "MOCK_AI=0\n");
    writeFileSync(join(dir, ".env.local"), "MOCK_AI=0\n");
    const target: Record<string, string | undefined> = { MOCK_AI: "1" };
    loadEnvFiles(dir, target);
    expect(target.MOCK_AI).toBe("1");
  });

  it(".env.local beats .env; .env fills the gaps", () => {
    writeFileSync(join(dir, ".env"), "AI_PROVIDER=gemini\nLOG_LEVEL=warn\n");
    writeFileSync(join(dir, ".env.local"), "AI_PROVIDER=groq\n");
    const target: Record<string, string | undefined> = {};
    loadEnvFiles(dir, target);
    expect(target.AI_PROVIDER).toBe("groq");
    expect(target.LOG_LEVEL).toBe("warn");
  });

  it("tolerates missing files", () => {
    const target: Record<string, string | undefined> = { A: "1" };
    loadEnvFiles(dir, target);
    expect(target).toEqual({ A: "1" });
  });
});
