# Day 6 — SKTW onboarding and real-world test

## Build
1. Create SKTW tenant via `/admin` with branding from `docs/reference/sktw/`; add tester as admin user.
2. Custom domain: Ayaz adds `CNAME itinerary.shreekrishnatravelworld.com → daywise.smallsoftware.in`; verify with CNAME checker; Caddy issues cert; login works on the custom domain.
3. Guided test session (Ayaz + SKTW tester): generate and share 10 real itineraries — Kashmir, Kerala, Goa, Rajasthan, Himachal, Andaman, Dubai, Bali, Thailand, Europe. Log every friction point as a `bug` issue with a screenshot.
4. Same-day fixes for anything blocking the definition of done.

## Accept
- [ ] Tester completes prompt → edit → share unaided on the custom domain
- [ ] ≥5 itineraries actually sent to real clients
- [ ] Fix list triaged: blockers fixed today, rest moved to Day 7 or Phase 8
