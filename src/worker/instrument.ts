/**
 * Sentry for the pg-boss worker. Loaded with `tsx --import` so it runs before
 * pino and the job modules are imported (required for auto-instrumentation).
 *
 * `--import` is inherited by worker threads (pino's transport thread in dev),
 * so initialise only on the main thread. tsx runs this file as CJS (no
 * top-level await), hence the guarded synchronous requires.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const { isMainThread } = require("node:worker_threads") as typeof import("node:worker_threads");

if (isMainThread) {
  require("../../scripts/load-env");
  const Sentry = require("@sentry/node") as typeof import("@sentry/node");
  const { sentryBaseOptions } =
    require("../lib/sentry/options") as typeof import("../lib/sentry/options");

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    ...sentryBaseOptions,
    initialScope: { tags: { service: "worker" } },
    // Jobs catch their own failures and log at error level (pg-boss never sees a
    // throw), so error/fatal pino logs become Sentry issues here, plus all logs.
    integrations: [Sentry.pinoIntegration({ error: { levels: ["error", "fatal"] } })],
  });
}
