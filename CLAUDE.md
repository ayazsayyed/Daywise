# Daywise — CLAUDE.md

Daywise is a multi-tenant SaaS for travel agencies: an agent types "5-day Kashmir for a couple, mid-range", Daywise drafts a Google-Places-verified, photo-rich, day-wise itinerary the agent edits and shares as a branded link or PDF. Tenant #1 is Shree Krishna Travel World (SKTW).

You are the sole engineer. Product decisions are already made — read `docs/PRD.md` and `docs/ROADMAP.md` before anything else. Each working day has a brief in `docs/phases/day-N.md` with acceptance criteria. Build exactly that; do not expand scope. If a brief is ambiguous, write the question into `docs/STATUS.md` under "Blocked / questions" and build the unambiguous parts.

## Session protocol
1. Read `docs/STATUS.md`, today's `docs/phases/day-N.md`, and open GitHub issues labelled `bug`.
2. Fix `bug` issues first, then build the day's scope.
3. Commit small, push to `main` (auto-deploys). Every push must pass `pnpm check` (typecheck + lint + unit tests).
4. End the session by updating `docs/STATUS.md`: done / not done / blocked, plus the live URL to test.

## Stack (locked — do not substitute)
- Next.js 15, App Router, TypeScript strict, `src/` layout. Server Components by default; client components only for the editor and interactive bits.
- Tailwind CSS + shadcn/ui. dnd-kit for drag-drop.
- Postgres 16 + Drizzle ORM (`drizzle-kit` migrations committed in `drizzle/`).
- pg-boss for background jobs (generation, PDF). Worker = `src/worker/index.ts`, run as a separate process from the same codebase.
- Vercel AI SDK (`ai`) with `generateObject` + zod schemas. Providers: Groq (`openai/gpt-oss-120b`) primary → Google Gemini Flash fallback. Provider chosen by `AI_PROVIDER` env; code must never import a provider directly outside `src/lib/ai/providers.ts`.
- Auth: own magic-link implementation (table `login_tokens`, 15-min single-use, 30-day httpOnly session cookie). Resend for email. No Auth.js, no Supabase.
- PDF: Playwright (Chromium) in the worker rendering `/s/[token]?print=1`.
- Files: Cloudflare R2 (S3 API) for tenant logos and nightly backups.
- Caddy with on-demand TLS; Docker Compose (app, worker, postgres, caddy). GitHub Actions deploys over SSH on push to `main`.
- Logging: pino. Errors: Sentry. Validation everywhere: zod.
- Package manager: pnpm.

## Non-negotiable rules
- **Tenant isolation:** every query touching tenant data goes through `src/lib/db/tenant.ts` helpers that take `tenantId` from the session, never from the request body or URL. Public share pages resolve tenant from the share token only.
- **AI never invents money, availability or star ratings.** Prices are agent-entered only. System prompts live in `src/lib/ai/prompts/` and must include this rule.
- **AI output is untrusted:** validate with zod, enforce requested day count and valid dates, retry once, then fail with a user-readable error.
- **Google Places:** Text Search field mask is exactly `places.id,places.displayName,places.formattedAddress,places.location,places.photos`. Never request rating/reviews (it re-prices the call). Store `place_id` and photo resource names, never photo bytes. Serve photos through `/api/photo/[ref]` with ≤30-day cache and max width 1200. Show author attribution wherever a Google photo is displayed. Hard monthly budget guard in `src/lib/places/budget.ts` — when exhausted, generation continues unverified and alerts via Sentry.
- **Image fallback chain:** Place photo → Pexels/Wikimedia destination image (cacheable, stored in R2) → branded SVG placeholder. Every image record carries a `source` field.
- **Share links:** unguessable 24+ char tokens, `noindex`, view tracking ignores known bot UAs. Disabled links render a friendly page with the agency's contact details. Suspended tenants: admin locked, links read-only for 30 days.
- **Dates:** store UTC, display `DD MMM YYYY`, timezone Asia/Kolkata. Currency INR by default.
- **Secrets:** only via env; `.env.example` is the contract. Never commit `.env`.
- **No new infrastructure** (Redis, queues, external auth, serverless) without a note in STATUS.md and explicit approval.

## Design direction
- **`docs/DESIGN.md` is binding.** It holds the exact tokens, type scale, component rules, a never-do list, a screen map to `docs/design/screens/*.png`, and the agreed deviations from the PDF. Open the PNG for the screen before writing JSX and compare against it before marking a phase done.
- Admin UI: Inter only, flat warm surfaces, hairlines, one indigo action per screen, no sidebar (56px top bar with text nav), compact tables, photos in fixed-ratio frames.
- Client-facing share page and PDF (Day 4): **tenant** logo and theme colour only, mobile-first, same token system; designed separately and added to `docs/design/` when ready.
- If the `frontend-design` skill is available, use it; the PNGs and DESIGN.md still win on any conflict.

## Code conventions
- Feature folders under `src/features/<name>/` (itinerary, editor, share, tenant, auth, admin). Shared infra under `src/lib/`.
- Server Actions for mutations; route handlers only for public APIs (photo proxy, share view, PDF).
- Tests: Vitest for `src/lib/ai/schemas`, tenant helpers, pricing maths. One Playwright e2e `e2e/share.spec.ts` (login → generate (mocked AI) → share link renders). Mock AI and Places in tests via `MOCK_AI=1`.
- Conventional commits. One PR-less push per logical unit is fine; `main` is the only branch.

## Commands
- `pnpm dev` — app; `pnpm worker` — background worker; `pnpm db:migrate`; `pnpm gen "5-day Kashmir couple mid-range"` — CLI generation for testing; `pnpm check`; `pnpm e2e`.
