# STATUS

_Updated by Claude Code at the end of every session. Ayaz reads this + the live URL each evening._

## Current phase
Day 1 — Skeleton live. Code complete and pushed to `main`; first deploy depends on server-side setup (see Blocked).

## Done
- Scaffold: Next.js 15.5 (App Router, TS strict, `src/`), Tailwind v4, shadcn/ui primitives, ESLint + Prettier, Vitest, `pnpm check`
- Drizzle schema for all Day 1 tables (tenants, users, login_tokens, sessions, itineraries, days, stops, hotels, share_links, places_cache, usage_events, audit_log, tenant_learnings); migration `drizzle/0000_init.sql`
- Tenant isolation helper `src/lib/db/tenant.ts` (`tenantScope`, `tenantWhere`) with unit tests
- Magic-link auth: `/login` → Resend → `/auth/verify` (15-min single-use, atomic consume) → 30-day httpOnly session; superadmin auto-provisioned from `SUPERADMIN_EMAIL`; middleware guards `/app/*` and `/admin/*`
- App shell + empty dashboard `/app` (disabled "New itinerary"); `/admin` read-only tenant list; `/no-tenant`, `/suspended` pages
- `/app/settings`: branding + defaults form, live client-facing preview, logo upload (PNG/SVG ≤1 MB, sniffed, SVG script check) to R2 under `tenants/<id>/`, served via `/api/files/*` or `R2_PUBLIC_URL`
- Seed `pnpm db:seed`: tenant `sktw` + superadmin user (idempotent). Worker: idle pg-boss with `generate-itinerary` / `render-pdf` queues
- Infra: multi-stage Dockerfile (app + worker targets), Compose (postgres, migrate, app, worker, caddy), Caddy on-demand TLS with `/api/tls-check`, `/api/health`, GitHub Actions `check → build/push GHCR → ssh deploy → health probe`
- Verified locally with Playwright: login → dashboard → settings save/reload → logout; single-use link rejected; cookie 30 days httpOnly; standalone prod build serves health + tls-check correctly

## Not done / carried over
- Live HTTPS deploy not yet confirmed. First run on `main`: `pnpm check` ✅, images built and pushed to GHCR ✅, deploy ❌ because `DEPLOY_HOST` / `DEPLOY_USER` / `DEPLOY_SSH_KEY` secrets are empty. Set them (plus `~/daywise/.env` on the KVM) and re-run the latest "CI & Deploy" workflow.
- Logo upload end-to-end against real R2 not exercised here (no R2 keys in this environment); code path and validation are tested, the R2 call is not.
- Magic-link email delivery via Resend not exercised here (no key); in dev the link is logged.
- `e2e/share.spec.ts` is a skipped stub until Day 4.

## Blocked / questions
- 9 Nov: client page + PDF design delivered — `docs/DESIGN.md` Part 2, PNGs 20–37. Day 4 brief updated. New tenant fields for the Day 2 migration if not yet run: `tagline`, `contact_person`.
- RESOLVED by Ayaz (9 Nov): design system delivered — see `docs/DESIGN.md` and `docs/design/`. Day 2 starts with the restyle addendum in `docs/phases/day-2.md`. Tenant subdomains: keep. Branch mirror: delete `claude/*` branches, `main` only.
- **Server prerequisites (Ayaz):** copy the filled `.env` to `~/daywise/.env` on the KVM with `POSTGRES_PASSWORD` and `ACME_EMAIL` added (new in `.env.example`), and set Actions secrets `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`. The deploy job fails fast with a clear message if `.env` is missing.
- **SKTW brand pack missing:** `docs/reference/sktw/` is not in the repo, so the seed uses a placeholder theme colour (`#1E6FB8`) and empty contact fields. Set the real values in `/app/settings` or commit the pack and I will update the seed.
- **letstrip.ai reference** (`docs/reference/`) not present; share-page design on Day 4 will follow CLAUDE.md's direction only unless it is added.
- **Tenant subdomains:** Day 0 DNS has `*.planner.smallsoftware.in`; `/api/tls-check` therefore also approves `<slug>.planner.smallsoftware.in`. Confirm this is intended, otherwise it is a one-line removal.
- **Branching:** this session's harness assigned branch `claude/sweet-carson-nm9bld`; per CLAUDE.md every unit was also pushed to `main`. Both are identical.
- `frontend-design` skill is not installed in this environment; settings/dashboard were built by hand to the CLAUDE.md design direction.

## Live URLs
- App: https://planner.smallsoftware.in (deploy pipeline in place; first successful deploy pending server `.env` + secrets)
- CI: https://github.com/ayazsayyed/Daywise/actions
