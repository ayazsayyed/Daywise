import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Token for internal ops endpoints, derived from SESSION_SECRET. Only something
 * that can read the server's env (the ops workflow, inside the app container)
 * can compute it. Purpose-bound so one token never unlocks another endpoint.
 */
export function opsToken(purpose: string, secret: string): string {
  return createHmac("sha256", secret).update(`ops:${purpose}`).digest("hex");
}

export function validOpsToken(
  purpose: string,
  given: string | null | undefined,
  secret: string,
): boolean {
  if (!given) return false;
  const want = Buffer.from(opsToken(purpose, secret));
  const got = Buffer.from(given);
  return want.length === got.length && timingSafeEqual(want, got);
}
