# Daywise — PRD v1.1 (finalised 9 Nov 2026)

**Product:** Daywise — admin product brand; tenant branding appears only on client-facing output. Hosted at daywise.smallsoftware.in; tenants map a CNAME (e.g. itinerary.shreekrishnatravelworld.com).
**One-liner:** A travel agent types "5-day Kashmir for a couple, mid-range"; Daywise drafts a verified, photo-rich, day-wise itinerary the agent edits and sends as a branded link or PDF in under 10 minutes.
**Tenant #1:** Shree Krishna Travel World (SKTW). Target price ₹2,000/tenant/month, invoiced manually in v1.
**Definition of done:** the SKTW tester completes prompt → edit → share unaided.

## 1. Access & tenancy
- One admin login per tenant via magic link (15-min, single-use); session 30 days; no public signup
- Tenants onboarded manually by Ayaz; CNAME checker on onboarding
- Super-admin panel: create tenant, set plan/caps, view AI + Places usage per tenant, suspend, "login as tenant"
- Per-tenant daily generation cap
- Suspended tenant: admin locked immediately; client links read-only for 30 days, then disabled
- Tenant data export (JSON) and deletion on request; privacy policy published (client PII under DPDP Act)

## 2. Branding (set once per tenant)
- Logo, theme colour, contact details (phone, WhatsApp, email, address), footer/T&Cs
- Default inclusions, exclusions, payment terms, cancellation text — pre-filled per itinerary, editable
- No other uploads: imagery from Google Places / Pexels / Wikimedia only

## 3. Generation
- Free-text prompt (English or Hinglish) → prompt enhancer → structured brief: destination(s), nights, dates, pax (adults/children + ages), budget tier, pace, season, entry/exit city, must-sees
- Brief confirmation step: assumed fields highlighted; agent edits, then generates
- Output: date-bound itinerary; days → stops; one hotel per night (room type, meal plan EP/CP/MAP/AP, check-in/out); transfers/transport line per day; multi-city and multi-country supported
- Verification: every hotel and stop → Google Places Text Search → place_id stored; unverified items carry a "verify before sending" badge
- Manual hotel/stop entry without Places (low-coverage destinations)
- Photos: Place photo → Pexels/Wikimedia destination image (cached in R2) → branded placeholder; expired refs re-fetched by place_id
- Regenerate a single day
- Hard rules: AI never invents prices, availability, or star ratings; season passed in; standard "subject to weather and local conditions" line
- Validation: zod enforces day count and valid dates; auto-retry once, then clear error
- Resilience: provider fallback; Places quota exhausted → continue unverified + alert
- Stored-edit learning loop (basic v1): per-tenant hotel swaps and added stops by destination injected into future prompts

## 4. Editor
- Drag-drop at day and stop level; add/remove days and stops; inline edit; autosave (last write wins)
- Hotel swap via Places search or manual entry
- Pricing modes with one toggle: total / per person / per adult + per child; INR default; show/hide on shared output
- Client block: name, travel dates, pax, contact
- Sections: inclusions, exclusions, payment terms, cancellation policy
- Duplicate itinerary; save as template (no client/dates); start from template
- Soft delete (share links die immediately)

## 5. Sharing
- Public read-only link, live-updating with "last updated" stamp, mobile-first, noindex, unguessable token; disable to expire
- Disabled/expired link → friendly page with agency contact details
- Branded PDF rendered on demand from the same template (not archived); photos resized via proxy (max 1200px); PDF target < 5 MB; Google photo attribution shown
- WhatsApp share with pre-filled message; copy link; download PDF
- View tracking: open count + last viewed, bots ignored
- Status: Draft → Sent → Confirmed / Lost

## 6. Dashboard
- List with search and filters (status, destination, dates, client)
- Quick actions: open, duplicate, copy link, PDF

## 7. Platform
- Provider-agnostic AI layer (Vercel AI SDK `generateObject`)
- Places budget guard with hard monthly stop; image fallback chain
- Audit log; nightly DB backup to R2; tenant isolation via a single query helper
- Dates DD MMM YYYY; timezone Asia/Kolkata

## Out of v1 (Phase 8 backlog)
Maps, multiple variants, bookings/payments, multi-user per tenant, costing engine, self-serve signup, non-English output, Razorpay billing, migration from the old Itinerary Builder.

## Week-1 success metrics
Prompt → shared link under 10 min; ≥80% hotels verified; ≤1 regeneration per itinerary; SKTW shares ≥5 real itineraries.

## Key constraints
- Free-tier AI (Groq ~1k req/day, 200k tokens/day) fine for one tenant; paid before tenant #2
- Google Places (New), India billing: 35k free Text Search Pro/month; Place Photos 1,000 free then ~$7/1k; no rating/reviews in field mask
- Google photos never stored; proxied, PDFs regenerated
