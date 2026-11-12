import * as Sentry from "@sentry/nextjs";

// Browser SDK. The DSN and release are inlined at build time (Docker build args in CI).
const isProduction = process.env.NODE_ENV === "production";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: isProduction ? "production" : "development",
  release: process.env.NEXT_PUBLIC_SENTRY_RELEASE || undefined,
  tracesSampleRate: isProduction ? 0.1 : 1.0,
  initialScope: { tags: { service: "browser" } },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
