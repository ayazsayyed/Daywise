import "./load-env";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import { deriveAccent } from "../src/features/pdf/tokens";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const sql = postgres(url, { max: 1 });
  const db = drizzle(sql);
  await migrate(db, { migrationsFolder: "./drizzle" });
  // 0007 backfill: every tenant gets an accent derived from its theme colour.
  const rows = await sql<{ id: string; theme: string | null }[]>`
    select id, branding->>'theme_color' as theme from tenants where accent_color is null`;
  for (const r of rows)
    await sql`update tenants set accent_color = ${deriveAccent(r.theme ?? "")} where id = ${r.id}`;
  if (rows.length) console.log(`accent backfilled for ${rows.length} tenant(s)`);
  await sql.end();
  console.log("migrations applied");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
