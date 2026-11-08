"use server";

import { and, eq, gt, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";

import { destroySession } from "@/lib/auth/session";
import {
  generateToken,
  hashLoginToken,
  LOGIN_TOKEN_TTL_MS,
  normaliseEmail,
} from "@/lib/auth/tokens";
import { db, schema } from "@/lib/db";
import { sendMail } from "@/lib/email/send";
import { magicLinkEmail } from "@/lib/email/templates";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

export type LoginState =
  { status: "idle" } | { status: "sent"; email: string } | { status: "error"; message: string };

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
});

const MAX_TOKENS_PER_WINDOW = 5;

/** Ensures the superadmin from env exists (role superadmin, no tenant until seeded/assigned). */
async function findOrProvisionUser(email: string) {
  const existing = await db.query.users.findFirst({
    where: sql`lower(${schema.users.email}) = ${email}`,
  });
  if (existing) return existing;
  if (email === normaliseEmail(env.SUPERADMIN_EMAIL)) {
    const [created] = await db
      .insert(schema.users)
      .values({ email, role: "superadmin", tenantId: null })
      .returning();
    return created ?? null;
  }
  return null;
}

export async function requestMagicLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid email" };
  }
  const email = parsed.data.email;

  try {
    const user = await findOrProvisionUser(email);
    // Always respond identically so the form cannot be used to enumerate accounts.
    if (!user) {
      logger.info({ email }, "magic link requested for unknown email");
      return { status: "sent", email };
    }

    const [{ count }] = (await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.loginTokens)
      .where(
        and(
          eq(schema.loginTokens.email, email),
          gt(schema.loginTokens.createdAt, new Date(Date.now() - LOGIN_TOKEN_TTL_MS)),
        ),
      )) as [{ count: number }];
    if (count >= MAX_TOKENS_PER_WINDOW) {
      return {
        status: "error",
        message: "Too many sign-in links requested. Try again in 15 minutes.",
      };
    }

    const token = generateToken();
    await db.insert(schema.loginTokens).values({
      email,
      tokenHash: hashLoginToken(token),
      expiresAt: new Date(Date.now() + LOGIN_TOKEN_TTL_MS),
    });

    const link = `${env.APP_URL}/auth/verify?token=${encodeURIComponent(token)}`;
    await sendMail({ to: email, ...magicLinkEmail(link) });
    return { status: "sent", email };
  } catch (err) {
    logger.error({ err }, "magic link request failed");
    return { status: "error", message: "We couldn't send the sign-in link. Please try again." };
  }
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
