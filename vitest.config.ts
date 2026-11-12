import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    // Test-only values so modules that read `env` validate; no network or DB is touched.
    env: {
      MOCK_AI: "1",
      SESSION_SECRET: "test-session-secret-not-used-anywhere-0000",
      SUPERADMIN_EMAIL: "admin@example.test",
      DATABASE_URL: "postgres://test:test@127.0.0.1:1/test",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // `server-only` throws outside Next's RSC runtime; tests run in plain Node.
      "server-only": path.resolve(__dirname, "src/test/server-only-stub.ts"),
    },
  },
});
