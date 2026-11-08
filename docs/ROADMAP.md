# Daywise — 7-Day Build Roadmap

**Method:** spec first; one vertical slice per day, deployed live the same day; AI pipeline CLI-testable before UI; one repo, one Compose stack; Ayaz tests 15 min each evening and logs notes in the phase issue; Claude Code clears `bug` issues first each morning.

**Definition of done:** the SKTW tester types "5-day Kashmir for a couple, mid-range", edits, and sends a branded PDF + link to a client unaided.

| Day | Phase | Ships | Accept when |
|---|---|---|---|
| 0 | Accounts & keys (Ayaz) | Filled `.env`, DNS, KVM ready | All items in `docs/phases/day-0.md` ticked |
| 1 | Skeleton live | Compose + Caddy + CI deploy, schema, magic-link login, tenant branding page, empty dashboard | Ayaz logs in over HTTPS, sets SKTW branding |
| 2 | AI pipeline | Enhancer → zod itinerary → Places verification + photos, provider fallback, CLI | `pnpm gen` returns valid itinerary, ≥80% hotels verified, <40 s |
| 3 | Editor | Create flow, drag-drop, hotel swap/manual, pricing modes, client block, sections, autosave, duplicate/template | Generate, reorder, swap, edit, reload — all persisted |
| 4 | Share | Public page, PDF, WhatsApp/copy/download, disable, view tracking, status | PDF ≈ link, opens on phone, link dies when disabled |
| 5 | Hardening | Caps, budget guard, Sentry, backups, tenant isolation tests, super-admin | Second test tenant cannot see SKTW data |
| 6 | SKTW onboarding | Tenant + CNAME, 10 real itineraries, same-day fixes | Tester completes definition of done |
| 7 | Buffer + handover | Fix list cleared, runbook, usage review | README runbook complete |

**Risks:** free-tier AI limits (abstracted, switch to paid at tenant #2); hotel hallucination (Places verification + badge); Google photo terms (proxy, no storage); scope creep (Phase 8 backlog only).

**Scaling path:** VPS → app replicas behind Caddy → managed Postgres → worker on its own box. No rewrite; the app is stateless.
