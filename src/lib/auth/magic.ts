import "server-only";

import { env } from "@/lib/env";
import { db, schema } from "@/lib/db";
import { sendMail } from "@/lib/email/send";
import { magicLinkEmail } from "@/lib/email/templates";

import { generateToken, hashLoginToken, LOGIN_TOKEN_TTL_MS } from "./tokens";

/** Writes a 15-minute single-use login token and emails the link. */
export async function issueMagicLink(email: string) {
  const token = generateToken();
  await db.insert(schema.loginTokens).values({
    email,
    tokenHash: hashLoginToken(token),
    expiresAt: new Date(Date.now() + LOGIN_TOKEN_TTL_MS),
  });
  const link = `${env.APP_URL}/auth/verify?token=${encodeURIComponent(token)}`;
  await sendMail({ to: email, ...magicLinkEmail(link) });
}
