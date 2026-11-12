import * as Sentry from "@sentry/nextjs";

import { sentryBaseOptions } from "@/lib/sentry/options";

// Next.js edge runtime (middleware).
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  ...sentryBaseOptions,
  initialScope: { tags: { service: "app" } },
});
