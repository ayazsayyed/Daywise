# Day 1 — Skeleton live

## Goal
A deployed, HTTPS, logged-in, branded, empty Daywise at daywise.smallsoftware.in by end of day.

## Build
1. **Scaffold:** Next.js 15 + TS strict + Tailwind + shadcn/ui + pnpm. `src/` layout per CLAUDE.md. ESLint + Prettier. `pnpm check` script.
2. **Infra:** `Dockerfile` (multi-stage, standalone output), `docker-compose.yml` (app, worker, postgres:16, caddy), `Caddyfile` with on-demand TLS (`ask` endpoint `/api/tls-check` that approves only known tenant domains + daywise.smallsoftware.in). `.github/workflows/deploy.yml`: on push to main → build → scp compose files → ssh `docker compose pull && up -d --remove-orphans`. Use GHCR for the image.
3. **Schema (Drizzle):** `tenants` (id, slug, name, custom_domain, status[active|suspended], suspended_at, plan, daily_gen_cap, branding jsonb{logo_url, theme_color, phone, whatsapp, email, address, footer}, defaults jsonb{inclusions, exclusions, payment_terms, cancellation}), `users` (id, tenant_id, email, role[admin|superadmin]), `login_tokens`, `sessions`, `itineraries` (id, tenant_id, title, status[draft|sent|confirmed|lost], client jsonb, brief jsonb, start_date, end_date, pricing jsonb{mode, show, total, per_person, per_adult, per_child, currency}, sections jsonb, is_template, deleted_at, created/updated), `days` (id, itinerary_id, position, date, title, summary, transport, hero_image jsonb), `stops` (id, day_id, position, kind[sight|activity|meal|transfer|note], title, description, duration, place_id, verified, image jsonb), `hotels` (id, day_id, name, place_id, verified, room_type, meal_plan, check_in, check_out, address, image jsonb, manual), `share_links` (id, itinerary_id, token unique, enabled, view_count, last_viewed_at), `places_cache` (place_id pk, tenant-agnostic payload jsonb, fetched_at), `usage_events` (tenant_id, kind[ai|places_search|places_photo|pdf], cost_units, created_at), `audit_log`, `tenant_learnings` (tenant_id, destination, kind, payload jsonb). Migration committed.
4. **Auth:** `/login` email form → Resend magic link → `/auth/verify?token=` → session cookie. Superadmin email from env auto-provisioned. Middleware guards `/app/*` and `/admin/*`.
5. **Tenant settings page** `/app/settings`: branding + defaults form, logo upload to R2 (PNG/SVG ≤1 MB), live preview card.
6. **Dashboard** `/app`: empty state with "New itinerary" button (non-functional until Day 3).
7. **Seed:** script creates SKTW tenant (slug `sktw`) + Ayaz as admin.

## Accept
- [ ] https://daywise.smallsoftware.in loads over valid TLS
- [ ] Magic link arrives within 30 s, logs in, session survives browser restart
- [ ] SKTW branding saved; logo renders from R2
- [ ] `pnpm check` green in CI; push to main deploys in < 5 min
- [ ] STATUS.md updated

## Notes
- Keep the worker container running an idle pg-boss instance so Day 2 only adds jobs.
- Superadmin can see `/admin` placeholder.
