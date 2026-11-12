# Daywise

AI itinerary planner for travel agencies. Prompt → verified day-wise itinerary → branded link or PDF.

- Product spec: `docs/PRD.md`
- Build plan: `docs/ROADMAP.md`
- Daily briefs: `docs/phases/day-N.md`
- Current state: `docs/STATUS.md`
- Engineering contract for Claude Code: `CLAUDE.md`

## Local
```
cp .env.example .env                       # fill keys (DATABASE_URL host → localhost)
docker compose -f docker-compose.dev.yml up -d   # Postgres 16 on :5432
pnpm i && pnpm db:migrate && pnpm db:seed  # schema + SKTW tenant + superadmin
pnpm dev                                   # http://localhost:3000
pnpm worker                                # second terminal (pg-boss)
```
Without `RESEND_API_KEY` the magic link is printed in the `pnpm dev` log instead of emailed.

## Generate from the CLI
`pnpm gen "5-day Kashmir for a couple, mid-range" [--tenant sktw] [--save] [--json]` runs enhancer → generator → Places
verification → photos in-process and prints a readable summary with verification %. `MOCK_AI=1` uses fixtures.
The same pipeline runs as the pg-boss job `generate-itinerary` in `pnpm worker`.

## Design check
`pnpm dev`, then `SESSION_TOKEN=$(pnpm exec tsx scripts/dev/mint-session.ts) node scripts/design-shots.mjs` writes
every screen at 1440 and 390 to `docs/design/actual/` for comparison with `docs/design/screens/` (see `docs/DESIGN.md`).

## Checks
`pnpm check` = typecheck + lint + unit tests (must pass before every push). `pnpm e2e` runs Playwright.

## Deploy
Push to `main` → GitHub Actions (`.github/workflows/deploy.yml`): `pnpm check` → build `app` and `worker`
images to GHCR → scp `docker-compose.yml` + `Caddyfile` to `~/daywise` on the KVM → `docker compose pull && up -d`
→ probe `/api/health`.

One-time server setup: Docker + Compose, `deploy` user with the Actions SSH key, ports 22/80/443 open,
and the filled `.env` copied to `~/daywise/.env` (set `POSTGRES_PASSWORD`, `ACME_EMAIL`). Caddy issues TLS
on demand; `/api/tls-check` approves only `daywise.smallsoftware.in`, `<slug>.daywise.smallsoftware.in`
and tenants' custom domains.
