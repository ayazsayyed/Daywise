# STATUS

_Updated by Claude Code at the end of every session. Ayaz reads this + the live URL each evening._

## Current phase
Day 2 — design restyle (addendum) done; AI pipeline built and CLI-tested with `MOCK_AI=1`. Live-provider acceptance (Groq/Gemini/Places/Pexels) still needs real keys — this sandbox could not reach Groq or Pexels at all.

## Done (Day 2)
### Restyle (DESIGN.md v1)
- Tokens in `globals.css` `@theme` (every colour, type, radius, shadow token); shadcn variables mapped onto them; `text-label`/`text-numeric`/`focus-ring` utilities; `tailwind-merge` taught the type scale (otherwise `text-label text-ink` silently dropped the size)
- shadcn primitives restyled in place (40px buttons: primary/secondary/quiet/destructive; raised inputs; tinted badges). `Card` removed. **shadcn CLI could not be run here** (registry unreachable through the sandbox proxy); the files are the CLI's current new-york v4 source with token overrides — re-run `pnpm dlx shadcn@latest add button input label textarea badge separator` on a connected machine only if you want to re-sync, then re-apply the token classes
- `src/components/ds/`: `TopBar` (+ `TopBarMenu`, `TopNav`, `TopBarAction` portal slot), `StatusDot` + `SaveState`, `VerifiedBadge`/`VerifyBadge`/`NeutralBadge`, `PhotoFrame`, `SectionLabel`, `SegmentedControl`, `Field`, `Page`/`PageTitle`
- Sidebar removed; 56px top bar (agency name · Itineraries · Settings · primary slot · initials menu with sign out). On phones the agency name opens the menu (PNG 18)
- `/login` (PNG 04/05/17): split hero with caption, 48px input + button, link-sent state with 60 s "Resend in 0:42" countdown, "Use a different email", support footer. Hero currently shows the sand ground + caption (deviation 9 image arrives once Pexels/R2 keys exist — the resolver is in place)
- `/app` empty state (PNG 07) and a token-faithful list for the non-empty case (`docs/design/actual/06-…`); `/app/settings` (PNG 15) with gutter sections, logo block (PNG/SVG/JPG ≤ 2 MB), six colour presets + hex with a light-colour warning, agency name, website, GSTIN, licence no., footer 240-char counter, save button + Unsaved/Saving/Saved state in the top bar, live client-header preview; `/admin` (PNG 16) table shell with month usage summary, search, amber at ≥80% of the AI cap
- Migration `0001`: `tenant_status` gains `trial`, `tenants.monthly_pdf_cap`, branding JSON backfilled with `website/gstin/licence_no` **and Part 2's `tagline`/`contact_person`** (both in Settings → Contact details, shown in the preview); client JSON type gains `city/referred_by`
- Theme colour contrast guard (Part 2 deviation 5): Settings refuses < 4.5:1 on #F7F5F1 client- and server-side and offers a one-click darkened value; presets all pass (amber preset is the `amber` token #8A5A12)
- `scripts/design-shots.mjs` + `scripts/dev/mint-session.ts` → `docs/design/actual/*.png` at 1440 and 390 for every screen above
- Format helpers (`src/lib/format.ts`: `DD MMM YYYY` in IST, Indian grouping, relative days), config constants (`src/lib/config/brand.ts`), `SUPPORT_EMAIL` env

### AI pipeline
- `src/lib/ai/providers.ts` — the only file importing `@ai-sdk/*`: Groq primary → Gemini fallback (DeepSeek/Qwen stubs), `generateObject` + zod, automatic fallback on 429/5xx/timeout/network, per-call usage reported and written to `usage_events` (`kind=ai`, tokens + provider in `meta`)
- `src/lib/ai/schemas.ts` — `Brief`, `ItineraryDraft` (strict objects → price/rating keys rejected; money/rating regex on every text field; meal plan enum; day count = nights+1; hotel every night, none on departure; dates computed from the brief, never by the model)
- Enhancer (`enhance.ts`, Hinglish-aware prompt, `assumed[]`), generator (`generate.ts`, prompt in `prompts/itinerary.md`, retry once with the validation issues, then a readable error), learnings (`learnings.ts` → "Agent preferences for this destination")
- Places (`src/lib/places/`): Text Search with the exact field mask, 30-day read-through cache (`places_queries` by query, `places_cache` by place_id), per-city location bias, `budget.ts` monthly caps from env → skip + flag + Sentry warn (throttled) when exhausted
- Photo proxy `/api/photo/[ref]` (base64url resource name, max width 1200, 30-day cache, `X-Photo-Attribution` from the cached place, budget-guarded, falls back to `/placeholder.svg`)
- Images (`src/lib/images/resolve.ts`): Place photo → Pexels → Wikimedia (stored in R2 under `images/<source>/…`, cached 90 days in `destination_images`) → `/placeholder.svg?label=&i=&color=`; every `ImageRef` has `source`
- Verify (`src/lib/itinerary/verify.ts`): concurrency 5, name-token match so "Nishat Bagh" never verifies as "Shalimar Bagh"; unverified items kept and flagged; hero image per day
- Pipeline (`src/lib/itinerary/pipeline.ts`), persistence through `tenantScope().createGeneratedItinerary` (transaction; sections from tenant defaults; pricing hidden/empty), pg-boss job `generate-itinerary` (`src/worker/jobs/generate.ts`) updating `generation_jobs` status + progress rows for the Day 3 progress screen; `enqueueGeneration()` in `src/features/itinerary/jobs.ts`
- CLI `pnpm gen "<prompt>" [--tenant sktw] [--save] [--json]`
- Tests (64): schemas (golden sample, wrong day count, price fields, money/rating text, meal plan), provider fallback, budget guard, field mask lock, photo refs, name matching, prompts carry the no-money rule, format, initials, branding additions

### Verified locally
- `pnpm check` green; migrations 0000–0002 apply on a fresh Postgres 16
- `pnpm gen "5-day Kashmir for a couple, mid-range"` (mock) → valid 5-day itinerary in ~1 s; worker path: enqueue → `generation_jobs` queued → done with progress rows → itinerary + 7 days + 19 stops + 6 hotels persisted
- `/placeholder.svg` renders; `/api/photo/<bad>` → 400; valid ref without a key → 302 to placeholder

## Not done / carried over
- **Day 2 acceptance with real providers not run** — no `GROQ_API_KEY`, `GEMINI_API_KEY`, `GOOGLE_PLACES_API_KEY`, `PEXELS_API_KEY` in this environment, and the sandbox proxy blocks api.groq.com and api.pexels.com outright. To accept: fill `.env.local`, then run the five prompts (`pnpm gen "5-day Kashmir couple mid-range"`, `"Kerala 6 days honeymoon"`, `"Dubai 4 days family of 4"`, `"Bali 7 days"`, `"Europe 10 days Paris Swiss"`), check ≥80% hotels verified on Kashmir/Kerala/Dubai and median < 40 s; force a bad `GROQ_API_KEY` once to see the Gemini fallback in the output's `AI:` line
- Pexels/Wikimedia hero on `/login` and the settings preview: resolver exists, wiring to those two spots is a 10-line follow-up once keys are present (kept the PNG's ground state for now)
- Mobile list cards with the `…` bottom sheet (PNG 18) and the full list columns/tabs/search (PNG 06) are Day 3 scope; today's list is a token-faithful table of what exists
- `/admin` create-tenant card, Suspend/Reactivate with type-to-confirm (PNG 16 right side) are Day 5; the table shell is done
- Live HTTPS deploy still unconfirmed (server `.env` + Actions secrets, see below). Note the two new migrations run automatically via the `migrate` compose service
- `e2e/share.spec.ts` remains a skipped stub until Day 4

## Intentional differences from the PNGs (restyle)
- Logo caption says "PNG, SVG or JPG up to 2 MB" and the upload accepts exactly that (Day 1 was PNG/SVG ≤ 1 MB)
- Sign-in error copy avoids contractions/exclamation marks per DESIGN.md "never do"
- Link-sent state keeps the "New to Daywise? Talk to us" header link (PNG 05 drops it); harmless and keeps the layout stable
- `/app` empty state primary "Create an itinerary" is disabled until `/app/new` exists (Day 3); PNG shows it enabled
- Admin table omits the Agents column (deviation 4) and shows `<custom domain>` or `<slug>.planner.smallsoftware.in` under the name instead of "City · subdomain" (tenants have no city field)
- Admin "AI calls" amber threshold uses `daily_gen_cap` as the monthly AI cap per deviation 4's mapping; rename the column when Day 5 touches caps

## Blocked / questions
- 12 Nov: hosting locked — new Hostinger KVM for Daywise (not yet purchased). Local-first until then: Day 3 and bug fixes #9–#11 proceed on Ayaz's machine; first deploy when the VPS exists.
- **Branch cleanup:** `claude/*` branches were deleted locally and all work goes to `main`, but the session proxy refuses ref deletion on GitHub (HTTP 403). `origin/claude/sweet-carson-nm9bld` (identical to the pre-design `main`) must be deleted from the GitHub UI (Branches page) — Ayaz
- **Server prerequisites (Ayaz):** copy the filled `.env` to `~/daywise/.env` on the KVM with `POSTGRES_PASSWORD`, `ACME_EMAIL` and now `SUPPORT_EMAIL` (optional), and set Actions secrets `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`
- **Keys for Day 2 acceptance** (see above): Groq, Gemini, Places, Pexels in the server `.env`
- **SKTW brand pack missing:** seed still uses placeholder theme `#1E6FB8` and empty contacts; set in `/app/settings` or commit `docs/reference/sktw/`
- **letstrip.ai reference** not present; share page (Day 4) will follow CLAUDE.md + DESIGN.md tokens only
- `frontend-design` skill not installed in this environment; screens were built from the PNGs + DESIGN.md directly

## Live URLs
- App: https://planner.smallsoftware.in (deploy pipeline in place; first successful deploy pending server `.env` + secrets)
- CI: https://github.com/ayazsayyed/Daywise/actions
- Local design check: `pnpm dev`, then `SESSION_TOKEN=$(pnpm exec tsx scripts/dev/mint-session.ts) node scripts/design-shots.mjs` → `docs/design/actual/`
