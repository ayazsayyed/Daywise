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
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
};

export default nextConfig;
