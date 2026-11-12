# STATUS

_Updated by Claude Code at the end of every session. Ayaz reads this + the live URL each evening._

## Current phase
Day 3 — editor built and accepted locally (mock AI + real Groq). Bugs #8–#11 fixed. Day 2 real-provider acceptance ran on Groq but **hotel/stop verification could not be measured**: the Places key is IP-restricted and Google rejects this sandbox's address (see Blocked).

All work is on branch `claude/day-3-setup-testing-qnfs5h` (this session may not push to `main`). Merge it to `main` to deploy once the KVM exists.

## Done (Day 3)
### Bug fixes (all with tests)
- #9 env precedence: shell > `.env.local` > `.env` (`src/lib/env-files.ts`)
- #8 four budget tiers (budget / mid-range / premium / luxury) in schema, enhancer and generator prompts
- #10 departure day may have no stops (schema), prompt asks for the airport transfer stop; generator and enhancer retry once on provider-side (Groq `json_validate_failed`) and SDK-side schema rejections, then fail readably
- #11 `assumed` lists only fields not derivable from the prompt: tighter prompt + `reconcileAssumed()` guard. Real Groq run of "5-day Kashmir couple mid-range" → `Assumed: start_date, pace, season, cities, entry_city, exit_city, must_sees`
- Found while running acceptance: a bad Groq key (401) did **not** fall back to Gemini; 401/403 now fall back (400 still does not). Places failures (no key, key restriction, network) are reported as "PLACES FAILED", no longer as "budget exhausted"

### Day 3 build
- **Data** (migration `0003_editor`): `stops.time` (backfilled from Day 2's "HH:MM · text" descriptions), `days.city`, `hotels.city`, `generation_jobs.kind/day_id/client`. Editor document + zod op union + shared reducer in `src/lib/itinerary/doc.ts`; tenant-scoped persistence in `src/lib/db/itinerary.ts` (via `tenantScope`): every id in an edit batch is checked against the itinerary before writing; swapped hotels are rebuilt server-side from the Places cache (the client cannot mark a hotel verified)
- **New itinerary** `/app/new` (PNG 08/09/10): describe → check the brief (assumed fields on indigo-soft, four budget tiers, pace, route, dates/length, must-sees, notes, client name → title "Kashmir for Ananya & Rohit") → progress screen polling the job (steps with results, elapsed/left, "Drafted so far", retry) → opens the editor. Start from template on step 1
- **Editor** `/app/i/[id]` (PNG 11/12/13/19): inline edit of title, day titles, summaries, transport, stop time/title/line/duration; add/remove stops; day strip (click scrolls, drag reorders); move/add/delete/collapse days, dates re-flow; stops drag within and across days (dnd-kit, shadow-float overlay, indigo-soft drop slot); autosave (optimistic, coalesced, 700 ms debounce, structural edits immediately, "Saved · 12:41" / "Not saved · Retry"); status menu; duplicate / save as template / delete (confirm)
- **Hotel card**: room, meal plan, check-in/out, Verified / "Verify before sending"; Swap = inline Places search (lodging, 5 results, thumb/name/address, ↑↓ Enter) or "Enter manually"
- **Regenerate this day**: `regenerate-day` pg-boss job redrafts one day with the rest of the itinerary as context, verifies it, replaces only that day
- **Right panel**: client (+ city, referred by), start date + adults/children/infants, pricing total / per person / adult + child with breakdown and total, free-text tax note, "Show price on shared itinerary"; inclusions, exclusions, payment terms, cancellation prefilled from agency defaults ("From agency defaults"). Phones: "Days" / "Details and price" tabs
- **Learning capture**: hotel swap → `hotel_swap`, manual stop add → `stop_added` rows in `tenant_learnings`
- **Dashboard** `/app` (PNG 06/18): summary line, search (`/`), status tabs with counts + Templates, sort, columns incl. last viewed by client, row-hover Open / Duplicate / Copy link + PDF (disabled until Day 4), "Show N more"; phones: cards + `…` bottom sheet with Delete (confirm)
- Photo proxy now sends the Places key in a header, never in the URL
- Tests: 115 (pricing maths, editor reducer, op ownership checks, list search/sort/summary, date labels, the bug fixes)

### Day 3 acceptance (local, `pnpm dev` + `pnpm worker`)
Driven in Chromium by script against the real UI, each checked after a page reload:
- [x] Prompt → brief → itinerary in the UI end to end (mock AI and real Groq)
- [x] Drag a day up, drag a stop across days, swap a hotel, edit text, change pricing mode, reload — everything persisted
- [x] Regenerate Day 3 changes only Day 3
- [x] Duplicate creates an independent copy (editing the copy leaves the original untouched); template has no client/dates/prices
- [x] Works at 390 px: list cards + action sheet, editor tabs, drag handles visible on touch
- Screenshots: `scripts/design-shots.mjs` now also shoots 06, 08, 09, 11, 13, 18, 19 (`ITINERARY_ID=<uuid>` for the editor)

### Day 2 acceptance with real providers (12 Nov, Places IP restriction removed)
Official run (`pnpm gen`, final code):

| Prompt | Provider | Seconds | Hotels verified | Stops verified |
|---|---|---|---|---|
| 5-day Kashmir couple mid-range | groq · gpt-oss-120b | 7.6 | 3/4 (75%) † | 7/8 |
| Kerala 6 days honeymoon | groq · gpt-oss-120b | 10.5 | 4/5 (80%) | 6/8 |
| Dubai 4 days family of 4 | groq · gpt-oss-120b | 28.7 | 3/3 (100%) | 5/5 |
| Bali 7 days | gemini · gemini-3.8-flash ‡ | 62.1 | 6/6 (100%) | 11/12 |
| Europe 10 days Paris Swiss | groq · gpt-oss-120b | 11.9 | 9/9 (100%) | 8/12 |
| Fallback (Groq key unset) — Kashmir | gemini · gemini-3.8-flash | 31.6 | 2/4 (50%) | 8/9 |

† Contaminated: the local `tenant_learnings` held hotel swaps written by my Day 3 UI tests (mock hotels "Srinagar Residency", "Gulmarg Residency"); the generator followed them as agent preferences. Learnings cleared, then two clean re-runs each:

| Prompt | Clean run 1 | Clean run 2 | Hotels, all clean runs |
|---|---|---|---|
| Kashmir | 2/4 · 7.6 s | 4/4 · 23.0 s | 6/8 = **75%** |
| Kerala | 3/5 · 10.2 s | 5/5 · 39.1 s | 12/15 = **80%** (incl. official run) |
| Dubai | 3/3 · 6.4 s | 3/3 · 30.4 s | 9/9 = **100%** |

‡ Groq failed twice on Bali; the retry/fallback path finished it on Gemini.

- [x] 5 prompts each produce a valid itinerary
- [ ] **≥80% hotels verified on Kashmir/Kerala/Dubai — Kashmir fails (75%), Kerala borderline (80%)**. Every miss checked against Places: the verifier is right, the model named hotels that do not exist where it put them — "Hotel Grand Mumtaz, Srinagar" (the chain is in Gulmarg/Pahalgam; Places returns "Hotel Mumtaz Towers"), "Hotel Fort Kochi" (generic, no such hotel), "Spice Routes Hotel, Thekkady" (nearest is "Spice Grove"). Unverified hotels are kept and flagged "Verify before sending", not dropped. **Stopped here for Ayaz's call** — see Blocked
- [x] Median generation < 40 s on Groq: 11.9 s (official run, Groq rows)
- [x] Fallback to Gemini proven (Groq key unset; the bad-key 401 path is unit-tested)
- [x] Photo proxy: `/api/photo/[ref]?w=800` → 200 `image/jpeg` 800×534, `cache-control: max-age=2592000`, `X-Photo-Attribution: Op Singh` + contributor URL. Needed a fix: real photo resource names (~460 chars) were rejected as "bad ref" by a 400-char limit, so no Google photo could ever display
- [x] Unit tests green (117)

## Not done / carried over
- **Day 2 hotel-verification gate not met for Kashmir** (75%) — awaiting decision, see Blocked
- Share link, PDF, WhatsApp (Copy link / PDF / Preview / Share buttons are visible but disabled) — Day 4
- Pexels hero on `/login` and settings preview (resolver exists; Pexels key not in this environment — its `Authorization: <key>` header without a prefix cannot be saved through the sandbox credential form)
- Per-must-see "Assumed" captions (PNG 09 shows some must-sees as assumed); the brief marks `must_sees` as a whole, so items are not individually flagged
- `e2e/share.spec.ts` still a stub until Day 4

## Intentional differences from the PNGs (Day 3)
- Brief step adds a **Route** field (cities in order); the PNG has none but the generator needs it
- Travellers on the brief is two number boxes (adults, children) instead of one "2 adults" field
- Swap results show no rating or review count (DESIGN.md deviation 1)
- Pricing shows a free-text **Tax note** instead of "GST 5% included" maths (deviation 2)
- Dashboard adds a **Templates** tab (count) for save-as-template / start-from-template
- Preview and Share are disabled with "arrives on Day 4" titles

## Done (Day 2, earlier)
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

## Day 2 carry-over notes (superseded above)
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
- **Decision needed (Ayaz) — Kashmir hotels verify at 75% (< 80% gate).** The model sometimes invents or misplaces mid-range hotels. Options: (a) *grounded hotel choice* (recommended): before drafting, one cached Places lodging search per city (30-day cache, ~1 call per city per month) and the prompt picks hotels only from those real names; (b) *repair pass*: after verification, re-ask the model only for unverified hotels, giving it the Places lodging results for that city (1 extra AI call when there are misses); (c) accept as-is — unverified hotels are already flagged "Verify before sending". Not started until you choose
- **Places key:** IP restriction removed for testing (12 Nov). Restore a restriction before production (by API: Places API (New) only, or the KVM's IP once it exists)
- **Test data:** the local DB used for acceptance had learnings from UI tests; mock-mode swaps write real `tenant_learnings` rows. Consider not recording learnings when `MOCK_AI=1`
- **Your `.env.local`:** if it sets `GEMINI_MODEL=gemini-2.5-flash`, change it to `gemini-3.8-flash` (2.5 Flash is closed to new API users). Optional `GROQ_REASONING_EFFORT=low` is the new default
- **Merge:** CLAUDE.md says push to `main`; this session could only push `claude/day-3-setup-testing-qnfs5h`. Merge it into `main` when you are happy (main auto-deploys once the KVM exists)
- 12 Nov: hosting locked — new Hostinger KVM for Daywise (not yet purchased). Local-first until then; first deploy when the VPS exists.
- **Branch cleanup:** `claude/*` branches were deleted locally and all work goes to `main`, but the session proxy refuses ref deletion on GitHub (HTTP 403). `origin/claude/sweet-carson-nm9bld` (identical to the pre-design `main`) must be deleted from the GitHub UI (Branches page) — Ayaz
- **Server prerequisites (Ayaz):** copy the filled `.env` to `~/daywise/.env` on the KVM with `POSTGRES_PASSWORD`, `ACME_EMAIL` and now `SUPPORT_EMAIL` (optional), and set Actions secrets `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`
- **Keys for Day 2 acceptance** (see above): Groq, Gemini, Places, Pexels in the server `.env`
- **SKTW brand pack missing:** seed still uses placeholder theme `#1E6FB8` and empty contacts; set in `/app/settings` or commit `docs/reference/sktw/`
- **letstrip.ai reference** not present; share page (Day 4) will follow CLAUDE.md + DESIGN.md tokens only
- `frontend-design` skill not installed in this environment; screens were built from the PNGs + DESIGN.md directly

## How to test Day 3 locally
```bash
pnpm install && pnpm db:migrate && pnpm db:seed
pnpm dev            # terminal 1
pnpm worker         # terminal 2 — generation and "Regenerate this day" run here
```
Sign in, then **New itinerary** → describe → check the brief → Generate. `MOCK_AI=1` for instant fixtures.

## Live URLs
- App: none yet — local only until the KVM exists (http://localhost:3000 with the steps above)
- CI: https://github.com/ayazsayyed/Daywise/actions
- Local design check: `pnpm dev`, then `SESSION_TOKEN=$(pnpm exec tsx scripts/dev/mint-session.ts) node scripts/design-shots.mjs` → `docs/design/actual/`
