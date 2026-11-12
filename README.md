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

## Ops without SSH
Actions → **Ops** → Run workflow runs one task on the KVM over the deploy key and never prints secret values:
`status` (set `.env` names, AI provider check, containers), `fix-ai-env`, `sentry-test` (one event each
from app and worker, prints event ids), `backup-now`, `backup-list`, `backup-restore-check`, `set-places-key`
(from the `GOOGLE_PLACES_API_KEY_PROD` Actions secret), `budget-sim`, `logs`.
Actions → **E2E (live)** runs the Playwright suite against the live site in throwaway `e2e-*` tenants.

## Backups and restore
The `backup` compose service (`docker/backup/`) runs `pg_dump -Fc` at **03:30 IST** (22:00 UTC) every night
and uploads `backups/daywise-<UTC stamp>.dump` to the R2 bucket, then deletes backups older than **14 days**.
A failed backup sends a Sentry error (`alert=backup_failed`).

Check backups: Ops → `backup-list`. Prove one restores without touching production: Ops →
`backup-restore-check` (restores the newest dump into a scratch database, prints row counts, drops it).

**Restore production** (on the KVM as `deploy`, in `~/daywise`):
```bash
docker compose exec backup restore.sh list
```
```bash
docker compose stop app worker
```
```bash
docker compose exec -e CONFIRM=daywise backup restore.sh daywise-20261112T1753Z.dump daywise
```
```bash
docker compose start app worker
```
`restore.sh <key|latest> <database>` downloads the dump and runs `pg_restore --clean --if-exists`; it refuses
the live database unless `CONFIRM=daywise` is set. Migrations are not re-run: a dump already carries the
`__drizzle_migrations` table, and the next deploy applies any newer ones.

**Restore on a laptop** (needs the R2 keys and Postgres 16 client tools):
```bash
AWS_ACCESS_KEY_ID=$R2_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY=$R2_SECRET_ACCESS_KEY AWS_DEFAULT_REGION=auto \
  aws s3 cp s3://daywise/backups/daywise-20261112T1753Z.dump . \
  --endpoint-url https://$R2_ACCOUNT_ID.r2.cloudflarestorage.com
```
```bash
createdb daywise_restore && pg_restore --no-owner --no-privileges -d daywise_restore daywise-20261112T1753Z.dump
```
