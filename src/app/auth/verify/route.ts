import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { createSession } from "@/lib/auth/session";
import { hashLoginToken } from "@/lib/auth/tokens";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/login?error=${reason}`, env.APP_URL));

  if (token.length < 24) return fail("invalid");

  const tokenHash = hashLoginToken(token);

  // Atomically consume the token: only one request can ever mark it used.
  const [consumed] = await db
    .update(schema.loginTokens)
    .set({ usedAt: sql`now()` })
    .where(
      and(
        eq(schema.loginTokens.tokenHash, tokenHash),
        isNull(schema.loginTokens.usedAt),
        gt(schema.loginTokens.expiresAt, new Date()),
      ),
    )
    .returning({ email: schema.loginTokens.email });

  if (!consumed) return fail("expired");

  const user = await db.query.users.findFirst({
    where: sql`lower(${schema.users.email}) = ${consumed.email}`,
  });
  if (!user) return fail("invalid");

  await createSession(user.id);
  logger.info({ userId: user.id }, "login");

  const dest = user.tenantId ? "/app" : user.role === "superadmin" ? "/admin" : "/no-tenant";
  return NextResponse.redirect(new URL(dest, env.APP_URL));
}
