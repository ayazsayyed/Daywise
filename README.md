# Daywise

AI itinerary planner for travel agencies. Prompt → verified day-wise itinerary → branded link or PDF.

- Product spec: `docs/PRD.md`
- Build plan: `docs/ROADMAP.md`
- Daily briefs: `docs/phases/day-N.md`
- Current state: `docs/STATUS.md`
- Engineering contract for Claude Code: `CLAUDE.md`

## Local
```
cp .env.example .env   # fill keys
docker compose up postgres -d
pnpm i && pnpm db:migrate && pnpm dev
pnpm worker            # second terminal
```

## Deploy
Push to `main` → GitHub Actions → SSH → `docker compose pull && up -d` on the KVM. Caddy issues TLS on demand for tenant custom domains.
