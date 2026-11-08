import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    env: { MOCK_AI: "1" },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // `server-only` throws outside Next's RSC runtime; tests run in plain Node.
      "server-only": path.resolve(__dirname, "src/test/server-only-stub.ts"),
    },
  },
});
