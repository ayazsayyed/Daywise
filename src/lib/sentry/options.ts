/**
 * Shared Sentry options for every runtime (Next server, edge, browser, worker).
 * Reads `process.env` directly: Sentry initialises before (and independently of)
 * the validated `env` proxy, and must never throw at boot. No DSN → SDK disabled.
 *
 * Trace sampling: every trace outside production (so local verification shows
 * one), 10% in production.
 */
const isProduction = process.env.NODE_ENV === "production";

export const sentryBaseOptions = {
  environment: process.env.SENTRY_ENVIRONMENT ?? (isProduction ? "production" : "development"),
  release: process.env.SENTRY_RELEASE || undefined,
  tracesSampleRate: isProduction ? 0.1 : 1.0,
} as const;
