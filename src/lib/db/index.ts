import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "@/lib/env";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;

declare global {
  var __daywiseDb: { sql: ReturnType<typeof postgres>; db: Db } | undefined;
}

function connect() {
  const sql = postgres(env.DATABASE_URL, { max: 10, prepare: false });
  const db: Db = drizzle(sql, { schema, casing: "snake_case" });
  return { sql, db };
}

/** Single lazily created pool per process (survives HMR in dev; never opened at import time). */
function getConn() {
  if (!globalThis.__daywiseDb) globalThis.__daywiseDb = connect();
  return globalThis.__daywiseDb;
}

export const db: Db = new Proxy({} as Db, {
  get(_t, prop) {
    const real = getConn().db as unknown as Record<PropertyKey, unknown>;
    const value = real[prop];
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(real) : value;
  },
});

export async function closeDb() {
  if (globalThis.__daywiseDb) {
    await globalThis.__daywiseDb.sql.end();
    globalThis.__daywiseDb = undefined;
  }
}

export { schema };
