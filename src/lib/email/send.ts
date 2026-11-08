import "server-only";

import { Resend } from "resend";

import { env, isProd } from "@/lib/env";
import { logger } from "@/lib/logger";

type Mail = { to: string; subject: string; html: string; text: string };

/** Sends via Resend. Without an API key in non-production, logs the message instead. */
export async function sendMail(mail: Mail): Promise<void> {
  if (!env.RESEND_API_KEY) {
    if (isProd()) throw new Error("RESEND_API_KEY is not configured");
    logger.info({ to: mail.to, subject: mail.subject, text: mail.text }, "email (dev, not sent)");
    return;
  }
  const resend = new Resend(env.RESEND_API_KEY);
  const { error } = await resend.emails.send({ from: env.EMAIL_FROM, ...mail });
  if (error) throw new Error(`Resend: ${error.name} ${error.message}`);
}
