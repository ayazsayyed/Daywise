import "server-only";

import { and, eq, gt, sql } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { cache } from "react";

import { db, schema } from "@/lib/db";
import { env, isProd } from "@/lib/env";
import { generateToken, hashSessionToken, SESSION_TTL_MS } from "./tokens";

export const SESSION_COOKIE = "dw_session";

export type SessionUser = {
  id: string;
  email: string;
  role: "admin" | "superadmin";
  tenantId: string | null;
};

export type CurrentSession = {
  id: string;
  user: SessionUser;
  tenant: typeof schema.tenants.$inferSelect | null;
};

export async function createSession(userId: string) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const h = await headers();
  await db.insert(schema.sessions).values({
    userId,
    tokenHash: hashSessionToken(token, env.SESSION_SECRET),
    expiresAt,
    userAgent: h.get("user-agent")?.slice(0, 500) ?? null,
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProd(),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await db
      .delete(schema.sessions)
      .where(eq(schema.sessions.tokenHash, hashSessionToken(token, env.SESSION_SECRET)));
  }
  jar.delete(SESSION_COOKIE);
}

/** Resolves the current session from the cookie. Cached per request. */
export const getSession = cache(async (): Promise<CurrentSession | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const tokenHash = hashSessionToken(token, env.SESSION_SECRET);
  const row = await db.query.sessions.findFirst({
    where: and(eq(schema.sessions.tokenHash, tokenHash), gt(schema.sessions.expiresAt, new Date())),
    with: { user: { with: { tenant: true } } },
  });
  if (!row) return null;

  // Touch last_seen at most once a day; fire-and-forget.
  if (Date.now() - row.lastSeenAt.getTime() > 24 * 60 * 60 * 1000) {
    void db
      .update(schema.sessions)
      .set({ lastSeenAt: sql`now()` })
      .where(eq(schema.sessions.id, row.id))
      .catch(() => {});
  }

  return {
    id: row.id,
    user: {
      id: row.user.id,
      email: row.user.email,
      role: row.user.role,
      tenantId: row.user.tenantId,
    },
    tenant: row.user.tenant ?? null,
  };
});
