# syntax=docker/dockerfile:1.7
# Two runtime targets from one build: `app` (Next standalone) and `worker` (pg-boss, tsx).

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
WORKDIR /app

# ── deps ────────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# ── build ───────────────────────────────────────────────────────────────
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Build-time placeholders: env is validated lazily at request time, never at build.
ENV NODE_ENV=production SESSION_SECRET=build-only-placeholder-secret-0123456789 \
    SUPERADMIN_EMAIL=build@example.com DATABASE_URL=postgres://build:build@localhost:5432/build
RUN pnpm build

# ── app (Next.js standalone) ────────────────────────────────────────────
FROM node:22-bookworm-slim AS app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
RUN groupadd -g 1001 nodejs && useradd -u 1001 -g nodejs -m nextjs
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]

# ── worker (pg-boss; also runs migrations) ──────────────────────────────
FROM base AS worker
ENV NODE_ENV=production DAYWISE_SERVICE=worker PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
COPY --from=deps /app/node_modules ./node_modules
# Chromium for the render-pdf job (Day 4): headless shell + its system libraries and fonts.
RUN npx playwright install --with-deps --only-shell chromium && chmod -R o+rx /ms-playwright
COPY package.json pnpm-lock.yaml tsconfig.json drizzle.config.ts ./
COPY src ./src
COPY scripts ./scripts
COPY drizzle ./drizzle
RUN groupadd -g 1001 nodejs && useradd -u 1001 -g nodejs -m worker && chown -R worker:nodejs /app
USER worker
CMD ["pnpm", "worker"]
