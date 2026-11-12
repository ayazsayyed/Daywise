import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * The PDF worker loads `/s/<token>?print=1&sig=<hmac>`. A valid signature
 * lets the render through even when the agent has turned the public link off
 * (the agent can still download a PDF) and is never counted as a view.
 * Without it, `print=1` is ignored and the page behaves like a normal open.
 */
export function printSignature(token: string, secret: string): string {
  return createHmac("sha256", secret).update(`print:${token}`).digest("base64url").slice(0, 32);
}

export function validPrintSignature(
  token: string,
  sig: string | undefined,
  secret: string,
): boolean {
  if (!sig) return false;
  const want = Buffer.from(printSignature(token, secret));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got);
}
