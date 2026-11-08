# Day 4 — Share: link, PDF, WhatsApp

**Design is binding:** `docs/DESIGN.md` Part 2 and PNGs 20–37 in `docs/design/screens/`. Open PNG 23 (mobile) and 29–34 (desktop) before building the page; 35–37 before the print stylesheet; 14 (admin share sheet) for the share panel. Build the page once and print from it.

## Goal
A client receives a branded link or PDF that looks identical and works on a phone.

## Build
1. **Public page** `/s/[token]` per DESIGN.md Part 2 structure 1–9 (header, cover, sticky day index + Overview sheet, days, price modes incl. hidden, included/excluded, terms, footer, sticky bottom bar, disabled/unavailable states). Tenant colour applied only where Part 2 allows; contrast-guarded value from Settings. Original spec: tenant branding (logo, theme colour, contact bar, footer), header with client name, dates, pax; per-day hero image, stops, hotel card, transport line; sections; pricing if `show`; "Last updated DD MMM YYYY"; `noindex`; resolves tenant from token only; custom-domain aware (Caddy on-demand TLS + `/api/tls-check`).
2. **Disabled/expired/suspended-30-days** → friendly page with agency contact details.
3. **View tracking:** increment `view_count`, `last_viewed_at`; ignore bot UAs; de-dupe by IP+UA per hour.
4. **PDF** per DESIGN.md Part 2 PDF rules (cover with Where-you-stay, one day per page, no split hotel cards, final price-and-terms page, running footer, photo re-encode targets). Original spec: pg-boss `render-pdf` job → Playwright loads `/s/[token]?print=1` with a print stylesheet (A4, page breaks per day, no nav) → streams PDF; never stored. Photos through the proxy at ≤1200px; target < 5 MB. Google attribution line under each Google photo.
5. **Share panel** in editor: enable/disable link, copy link, WhatsApp share (`wa.me` with prefilled "Hi <client>, here is your <destination> itinerary from <agency>: <link>"), Download PDF (shows "Preparing…" until job completes), status selector Draft/Sent/Confirmed/Lost (auto → Sent on first share).

## Accept
- [ ] Mobile page at 390 matches PNG 23/24/25 (sticky index, Overview sheet, sticky bar); desktop at 1200 matches 29–34
- [ ] Pricing hidden mode removes section, index entry and rule; sticky bar reads "Ask for price"
- [ ] Disabled and unavailable states match PNG 27/28 and show the agency header, never Daywise
- [ ] PDF cover, a day page and the terms page match PNG 35–37; no hotel card split; photo credit line lists Google author attributions
- [ ] Link opens on a phone, matches editor content, updates live after an edit
- [ ] PDF downloads in < 20 s, < 5 MB, page breaks per day, branding + attribution present
- [ ] Disabling the link shows the friendly page within seconds
- [ ] WhatsApp share opens with correct message
- [ ] View count increments from a real phone, not from curl with a bot UA
