import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  // pino uses worker threads for transports; keep it (and the pg drivers) out of the webpack bundle.
  serverExternalPackages: ["pino", "pino-pretty", "postgres", "pg-boss"],
  images: {
    // Logos are served from R2 (public URL or proxy); Google photos via /api/photo (Day 2).
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  // Client pages are never indexed and never leak their token via Referer.
  async headers() {
    return [
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

export default nextConfig;
