import "./scripts/load-env";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://daywise:password@localhost:5432/daywise",
  },
  strict: true,
  verbose: true,
});
