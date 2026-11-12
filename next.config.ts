import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Content-Security-Policy (Day 5 security pass). Scripts: self + inline (Next's
 * hydration payload; a nonce would force every page dynamic). Images: self,
 * data/blob, and https (tenant logos on R2, Pexels/Wikimedia heroes). Connect:
 * self + Sentry ingest. No framing, no plugins, forms post to self only.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://*.ingest.de.sentry.io${isDev ? " ws:" : ""}`,
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  // pino uses worker threads for transports; keep it (and the pg drivers) out of the webpack bundle.
  serverExternalPackages: ["pino", "pino-pretty", "postgres", "pg-boss", "sharp"],
  images: {
    // Logos are served from R2 (public URL or proxy); Google photos via /api/photo (Day 2).
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  // Client pages are never indexed and never leak their token via Referer.
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/s/:token*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cache-Control", value: "private, no-store" },
        ],
      },
    ];
  },
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
};

export default withSentryConfig(nextConfig, {
  org: "adfox-media",
  project: "daywise",
  // Release = git SHA from CI (Docker build arg); unset locally.
  release: { name: process.env.NEXT_PUBLIC_SENTRY_RELEASE || undefined },
  // Source maps upload only when a build-time SENTRY_AUTH_TOKEN is present (CI).
  authToken: process.env.SENTRY_AUTH_TOKEN,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  widenClientFileUpload: true,
  silent: !process.env.CI,
});
