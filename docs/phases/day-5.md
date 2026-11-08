# Day 5 — Hardening, super-admin, ops

## Build
1. **Super-admin** `/admin`: tenants list, create tenant (slug, name, admin email, custom domain, plan, daily cap), suspend/unsuspend (links read-only for 30 days then disabled), usage per tenant (AI tokens, Places searches/photos, PDFs) this month, "login as tenant", CNAME checker (DNS lookup shows expected vs actual).
2. **Caps & guards:** per-tenant daily generation cap enforced in the job enqueue; Places monthly budget guard proven; rate limits on login (5/15 min/email), public page (60/min/IP), photo proxy.
3. **Tenant isolation tests:** Vitest over `src/lib/db/tenant.ts`; e2e creating a second tenant and asserting 404s across tenants.
4. **Observability:** Sentry wired in app + worker; pino structured logs; `/api/health`. Uptime Kuma optional on the KVM.
5. **Backups:** nightly `pg_dump` → R2 via cron container; documented restore.
6. **Data export** per tenant (JSON zip) and delete-tenant with confirm; privacy policy page `/privacy`.
7. **Audit log** for login, tenant changes, share enable/disable, deletes.
8. **UX polish:** loading states for 30–40 s generation, error states with retry, empty states.
9. **Security pass:** CSP, secure cookies, key restrictions verified, dependency audit.

## Accept
- [ ] Second test tenant cannot see or guess SKTW data (manual + e2e)
- [ ] Suspend → admin locked, links still render; unsuspend restores
- [ ] Budget guard exhaustion simulated → generation completes unverified + Sentry event
- [ ] Backup file appears in R2 and restores locally
- [ ] `pnpm check` + e2e green
