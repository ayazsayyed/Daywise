# Day 2 — AI pipeline (CLI first)

## Goal
`pnpm gen "5-day Kashmir couple mid-range"` prints a valid, verified itinerary with photos in < 40 s. No UI today beyond wiring the job.

## Build
1. **Provider layer** `src/lib/ai/providers.ts`: Groq primary, Gemini fallback, DeepSeek/Qwen stubs; selected by env; automatic fallback on 429/5xx/timeout. All calls log tokens to `usage_events`.
2. **Schemas** `src/lib/ai/schemas.ts`: `Brief`, `Itinerary` (days → stops, hotel per night, transport line), with refinements: day count == nights+1, dates contiguous, meal_plan enum, no price fields allowed from AI.
3. **Enhancer** `enhance(prompt) → Brief` with `assumed: string[]` listing fields it guessed. Handles Hinglish and vague prompts with sensible Indian-market defaults (INR, couple, mid-range, relaxed pace).
4. **Generator** `generate(brief, learnings) → Itinerary` with system prompt in `src/lib/ai/prompts/itinerary.md` encoding the hard rules (no prices/availability/ratings, season awareness, weather disclaimer, transfers per day, meal plans). Retry once on schema failure.
5. **Places** `src/lib/places/`: `textSearch(query, locationBias)` with the exact field mask; `places_cache` read-through (30 days); `budget.ts` monthly caps from env → when exceeded, skip verification, mark unverified, Sentry warn. `photoUrl(ref)` → `/api/photo/[ref]` proxy with max width 1200, 30-day cache headers, attribution passthrough.
6. **Images** `src/lib/images/`: resolver with fallback chain Place photo → Pexels (search "<destination> landscape", cache to R2 with `source: pexels` + attribution) → Wikimedia → `/placeholder.svg?color=`.
7. **Verify step:** for each hotel/stop, text search "<name>, <city>" → set place_id/verified/image. Concurrency 5.
8. **Job:** pg-boss `generate-itinerary` job: enhancer (if brief missing) → generate → verify → persist to tables → emit progress rows for the UI to poll.
9. **Learnings:** read `tenant_learnings` for the destination and append "Agent preferences for this destination" to the prompt.
10. **CLI** `pnpm gen "<prompt>" [--tenant sktw]` prints a readable summary + verification %.
11. **Tests:** Vitest for schemas (reject wrong day count, reject price fields, accept golden sample), provider fallback, budget guard. `MOCK_AI=1` returns a fixture.

## Accept
- [ ] 5 prompts (Kashmir 5d, Kerala 6d honeymoon, Dubai 4d family, Bali 7d, "Europe 10 days Paris Swiss") each produce a valid itinerary
- [ ] ≥80% hotels verified on Kashmir/Kerala/Dubai; unverified items flagged, not dropped
- [ ] Median generation < 40 s on Groq; fallback to Gemini proven by forcing a bad Groq key
- [ ] Photo proxy serves a resized image with attribution header
- [ ] Unit tests green
