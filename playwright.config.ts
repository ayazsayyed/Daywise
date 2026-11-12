import { defineConfig } from "@playwright/test";

// DATABASE_URL / SUPERADMIN_EMAIL for the login step (shell > .env.local > .env).
import "./scripts/load-env";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "off",
  },
});
