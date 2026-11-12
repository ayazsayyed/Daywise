import * as Sentry from "@sentry/nextjs";

import { sentryBaseOptions } from "@/lib/sentry/options";

// Next.js Node runtime (Server Components, route handlers, Server Actions).
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  ...sentryBaseOptions,
  initialScope: { tags: { service: "app" } },
  // pino → Sentry Logs (errors are captured by the SDK itself, not duplicated from logs).
  integrations: [Sentry.pinoIntegration()],
});
