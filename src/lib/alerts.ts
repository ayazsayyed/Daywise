import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * Operational alerts. Goes to Sentry when SENTRY_DSN is set (SDK initialised in
 * `src/sentry.server.config.ts` for the app, `src/worker/instrument.ts` for the
 * worker), always to the log. Throttled per key so a stuck condition
 * (e.g. Places budget exhausted) alerts once an hour, not once per request.
 */
const lastSent = new Map<string, number>();
const THROTTLE_MS = 60 * 60 * 1000;

export async function alert(
  level: "warning" | "error",
  key: string,
  message: string,
  extra: Record<string, unknown> = {},
): Promise<string | undefined> {
  const now = Date.now();
  const prev = lastSent.get(key) ?? 0;
  if (now - prev < THROTTLE_MS) return undefined;
  lastSent.set(key, now);

  (level === "error" ? logger.error : logger.warn).call(logger, { alert: key, ...extra }, message);
  if (!env.SENTRY_DSN) return undefined;
  try {
    // @sentry/core: runtime-agnostic, shares the client initialised by either SDK.
    const Sentry = await import("@sentry/core");
    return Sentry.captureMessage(message, { level, tags: { alert: key }, extra });
  } catch (err) {
    logger.error({ err }, "Sentry capture failed");
    return undefined;
  }
}

/** Test hook. */
export function _resetAlertThrottle() {
  lastSent.clear();
}
