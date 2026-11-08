# Day 4 — Share: link, PDF, WhatsApp

## Goal
A client receives a branded link or PDF that looks identical and works on a phone.

## Build
1. **Public page** `/s/[token]`: tenant branding (logo, theme colour, contact bar, footer), header with client name, dates, pax; per-day hero image, stops, hotel card, transport line; sections; pricing if `show`; "Last updated DD MMM YYYY"; `noindex`; resolves tenant from token only; custom-domain aware (Caddy on-demand TLS + `/api/tls-check`).
2. **Disabled/expired/suspended-30-days** → friendly page with agency contact details.
3. **View tracking:** increment `view_count`, `last_viewed_at`; ignore bot UAs; de-dupe by IP+UA per hour.
4. **PDF:** pg-boss `render-pdf` job → Playwright loads `/s/[token]?print=1` with a print stylesheet (A4, page breaks per day, no nav) → streams PDF; never stored. Photos through the proxy at ≤1200px; target < 5 MB. Google attribution line under each Google photo.
5. **Share panel** in editor: enable/disable link, copy link, WhatsApp share (`wa.me` with prefilled "Hi <client>, here is your <destination> itinerary from <agency>: <link>"), Download PDF (shows "Preparing…" until job completes), status selector Draft/Sent/Confirmed/Lost (auto → Sent on first share).

## Accept
- [ ] Link opens on a phone, matches editor content, updates live after an edit
- [ ] PDF downloads in < 20 s, < 5 MB, page breaks per day, branding + attribution present
- [ ] Disabling the link shows the friendly page within seconds
- [ ] WhatsApp share opens with correct message
- [ ] View count increments from a real phone, not from curl with a bot UA
