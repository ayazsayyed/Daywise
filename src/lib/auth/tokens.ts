import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const LOGIN_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes, single use
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/** 32 random bytes, base64url → 43 chars, unguessable. */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** Login tokens are short-lived; a plain SHA-256 is enough and keeps verification stateless. */
export function hashLoginToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Session tokens are keyed with SESSION_SECRET so a database dump cannot mint cookies. */
export function hashSessionToken(token: string, secret: string): string {
  return createHmac("sha256", secret).update(token).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}
