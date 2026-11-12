# Daywise — Setup runbook (Day 0 → first deploy → Day 2 acceptance)

Follow top to bottom. Each part ends with a check. Budget: Part A 20 min, B 15 min, C 10 min, D 45 min (mostly waiting on DNS/billing), E 10 min.

Already have: Groq key, Pexels key. Everything else is created below.

---

## Part A — Local machine (so Claude Code and `pnpm gen` run with real network)

**A1. Prerequisites**
- Node 22: `node -v` → v22.x. If not: install via nvm (`nvm install 22 && nvm use 22`).
- pnpm 10: `corepack enable && corepack prepare pnpm@10.28.0 --activate` → `pnpm -v` → 10.28.0.
- Docker Desktop running: `docker ps` prints a header, no error.
- git + GitHub auth: `gh auth status` (install `gh` if missing, then `gh auth login`).

**A2. Clone and install**
```
git clone https://github.com/ayazsayyed/Daywise.git daywise
cd daywise
pnpm install --frozen-lockfile
```

**A3. Local Postgres (Docker, separate from the production stack)**
```
docker run -d --name daywise-pg -e POSTGRES_USER=daywise -e POSTGRES_PASSWORD=daywise -e POSTGRES_DB=daywise -p 5432:5432 postgres:16-alpine
```
Check: `docker ps | grep daywise-pg` shows it Up.

**A4. Local env file** — create `.env.local` (git-ignored). Minimum to run everything locally:
```
APP_URL=http://localhost:3000
NODE_ENV=development
SESSION_SECRET=<paste output of: openssl rand -hex 32>
SUPERADMIN_EMAIL=ayaz@adfox.media
DATABASE_URL=postgres://daywise:daywise@localhost:5432/daywise

AI_PROVIDER=groq
AI_FALLBACK_PROVIDER=gemini
GROQ_API_KEY=<your Groq key>
GEMINI_API_KEY=<from Part B>
GOOGLE_PLACES_API_KEY=<from Part C>
PEXELS_API_KEY=<your Pexels key>
MOCK_AI=0
```
Resend/R2/Sentry are optional locally: without Resend the magic link is printed in the terminal; without R2 the logo upload is disabled.

**A5. Migrate, seed, smoke**
```
pnpm db:migrate
pnpm db:seed
pnpm check
MOCK_AI=1 pnpm gen "5-day Kashmir couple mid-range"
```
Check: `pnpm check` green, mock gen prints a 5-day itinerary.

**A6. Run the app locally (optional now, needed for Day 3 testing)**
Terminal 1 `pnpm dev`, Terminal 2 `pnpm worker`. Open http://localhost:3000/login, enter your email, copy the link from Terminal 1's log, open it. You should land on `/app`.

**A7. Claude Code on this machine**
```
cd daywise
claude
```
First message: the Day 3 prompt from chat. Claude Code now reaches Groq, Places, the shadcn registry and your local Postgres.

---

## Part B — Gemini key (fallback provider), 3 minutes
1. https://aistudio.google.com → Get API key → Create API key (new project is fine).
2. Put it in `.env.local` as `GEMINI_API_KEY`.
Check: `AI_PROVIDER=gemini pnpm gen "Goa 3 days"` runs and the output's `AI:` line names Gemini.

---

## Part C — Google Cloud + Places API (New), 10 minutes + billing verification
1. https://console.cloud.google.com → New project → name `daywise` → Create.
2. Billing → Link a billing account. Create one with **country India** and your card. (India billing is what gives 35,000 free Text Search Pro calls/month.) Verification can take a few minutes to a day.
3. APIs & Services → Library → search **Places API (New)** → Enable. (Not the legacy "Places API".)
4. **Two keys** (issue #15). APIs & Services → Credentials → Create credentials → API key, twice:

   | Key name | Application restrictions | API restrictions | Lives in |
   |---|---|---|---|
   | `daywise-prod` | **IP addresses** → `200.141.14.237` (the KVM) only | Restrict key → **Places API (New)** only | server `~/daywise/.env` `GOOGLE_PLACES_API_KEY` |
   | `daywise-dev` | None (laptops and cloud sandboxes have changing IPs) | Restrict key → **Places API (New)** only | your `.env.local` `GOOGLE_PLACES_API_KEY` |

   The dev key is the one that existed before go-live (rename it to `daywise-dev`, keep its API restriction, leave application restrictions at None). Never copy the prod key to a laptop: it will fail there by design.
5. **Put the prod key on the server without SSH:** GitHub → repo Settings → Secrets and variables → Actions → New repository secret `GOOGLE_PLACES_API_KEY_PROD` = the `daywise-prod` key. Then Actions → **Ops** → Run workflow → task `set-places-key`. It backs up `.env`, replaces `GOOGLE_PLACES_API_KEY`, restarts app + worker and prints only the key length. Delete the Actions secret afterwards if you like; the server keeps its copy.
6. Billing → Budgets & alerts → Create budget: ₹2,000/month, alerts at 50/90/100%. The app also stops calling Places at `PLACES_MONTHLY_TEXT_SEARCH_CAP` / `PLACES_MONTHLY_PHOTO_CAP` and sends a Sentry warning (Ops → `budget-sim` proves it).
Check (dev): `pnpm gen "5-day Kashmir couple mid-range"` prints hotels with `verified` and a Places photo ref. If every hotel is unverified, the key restriction or billing is the problem; the CLI error line says which.
Check (prod): open any itinerary on https://daywise.smallsoftware.in — hotel photos load through `/api/photo/…`. The worker log (Ops → `logs`, service `worker`) shows no "PLACES FAILED".

---

## Part D — Server, DNS, email, storage, deploy

**D1. VPS readiness** — decision locked 12 Nov: a **new Hostinger KVM** (Mumbai) dedicated to Daywise; the old KVM with AdFox HQ / MarkupFox is not reused. Buy KVM 1 (4 GB) or KVM 2 (8 GB) with Ubuntu 24.04. SSH in as root:
```
ss -tlnp | grep -E ':80 |:443 '
```
- **Nothing printed** → ports are free, continue.
- **Something printed (nginx, apache, traefik, another caddy)** → STOP. AdFox HQ / MarkupFox already own 80/443 on this box. Tell Claude (chat) which proxy it is; the fix is either to serve Daywise through that proxy or to move Daywise to its own small VPS. Do not proceed until decided.

Then:
```
# Docker + Compose
curl -fsSL https://get.docker.com | sh
# deploy user
adduser --disabled-password --gecos "" deploy
usermod -aG docker deploy
mkdir -p /home/deploy/.ssh && chmod 700 /home/deploy/.ssh
```
On your **laptop**: `ssh-keygen -t ed25519 -f ~/.ssh/daywise_deploy -C daywise-deploy -N ""` then copy the public key:
`cat ~/.ssh/daywise_deploy.pub` → paste into the server's `/home/deploy/.ssh/authorized_keys`; on the server `chown -R deploy:deploy /home/deploy/.ssh && chmod 600 /home/deploy/.ssh/authorized_keys`.
Check from laptop: `ssh -i ~/.ssh/daywise_deploy deploy@<KVM_IP> docker ps` works.
Firewall: `ufw allow 22,80,443/tcp` (and 443/udp for HTTP/3 if you like) if ufw is on.
⚠ Also: `timedatectl set-timezone Asia/Kolkata`; check `systemctl is-enabled fail2ban unattended-upgrades`.
⚠ The hardened sshd penalises clients that open connections without authenticating. `ssh-keyscan` with no `-t` probes every key type and the ecdsa/sk probes fail, which got the GitHub runner banned by fail2ban on the first deploy. The workflow now runs `ssh-keyscan -t ed25519`; if a run fails with "Connection closed by … port 22", check `sudo fail2ban-client status sshd` and `journalctl -u ssh`.

**D2. DNS** (wherever smallsoftware.in is managed)
- `A  daywise.smallsoftware.in  → <KVM_IP>`  TTL 300
- `A  *.daywise.smallsoftware.in → <KVM_IP>`  TTL 300
Check: `dig +short daywise.smallsoftware.in` returns the IP.
⚠ If smallsoftware.in is on Cloudflare, both records must be **DNS only (grey cloud)**. Proxied, `dig` returns Cloudflare IPs, Caddy cannot issue certificates, and `*.daywise.smallsoftware.in` (a second-level wildcard) is not covered by Universal SSL, so tenant hosts fail the TLS handshake at the edge.

**D3. Resend (magic-link email)**
1. https://resend.com → sign up → Domains → Add `smallsoftware.in` → add the DKIM/SPF/MX records it shows at your DNS → wait for Verified.
2. API Keys → Create → "daywise-prod" (Sending access) → copy.
Check: domain shows Verified; keep key for the server `.env`.
⚠ The verified sending domain is `updates.smallsoftware.in`, so `EMAIL_FROM` must be `Daywise <login@updates.smallsoftware.in>` (a bare domain without a mailbox is rejected).

**D4. Cloudflare R2 (logos, cached hero images, backups)**
1. Cloudflare dashboard → R2 → Create bucket `daywise` (APAC location).
2. R2 → Manage R2 API Tokens → Create → Object Read & Write, scoped to bucket `daywise` → copy Access Key ID, Secret Access Key, and the Account ID (shown on the R2 overview).
3. Optional now: Settings → Public access → connect a custom domain like `cdn.daywise.smallsoftware.in` → that becomes `R2_PUBLIC_URL`. Skip for v1; files are served through the app.

**D5. Sentry (optional but cheap)**
https://sentry.io → New project → Next.js → copy the DSN.

**D6. Server `.env`**
On the server as `deploy`: `mkdir -p ~/daywise && nano ~/daywise/.env` and fill from `.env.example`:
```
APP_URL=https://daywise.smallsoftware.in
NODE_ENV=production
SESSION_SECRET=<openssl rand -hex 32, a DIFFERENT one from local>
SUPERADMIN_EMAIL=ayaz@adfox.media
POSTGRES_PASSWORD=<openssl rand -hex 16>
DATABASE_URL=postgres://daywise:<same POSTGRES_PASSWORD>@postgres:5432/daywise
AI_PROVIDER=groq
AI_FALLBACK_PROVIDER=gemini
GROQ_API_KEY=...
GEMINI_API_KEY=...
GOOGLE_PLACES_API_KEY=...
PEXELS_API_KEY=...
RESEND_API_KEY=...
EMAIL_FROM=Daywise <login@smallsoftware.in>
SUPPORT_EMAIL=support@smallsoftware.in
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=daywise
ACME_EMAIL=ayaz@adfox.media
SENTRY_DSN=...
LOG_LEVEL=info
```
`chmod 600 ~/daywise/.env`.
⚠ Easier than nano: build the file on the laptop and pipe it over — `ssh deploy@<KVM_IP> 'umask 077; mkdir -p ~/daywise; cat > ~/daywise/.env' < server.env`, then delete the local copy. Verify with `grep -c = ~/daywise/.env`, never `cat`.

**D7. GitHub Actions secrets**
Repo → Settings → Secrets and variables → Actions → New repository secret:
- `DEPLOY_HOST` = KVM IP
- `DEPLOY_USER` = `deploy`
- `DEPLOY_SSH_KEY` = contents of `~/.ssh/daywise_deploy` (the **private** key, whole file including BEGIN/END lines)
⚠ From the laptop: `gh secret set DEPLOY_HOST --body <IP>`, `gh secret set DEPLOY_USER --body deploy`, `gh secret set DEPLOY_SSH_KEY < ~/.ssh/daywise_deploy`, and `gh api -X PUT repos/ayazsayyed/Daywise/actions/permissions/workflow -f default_workflow_permissions=write`.
Also: Settings → Actions → General → Workflow permissions → **Read and write** (needed to push images to GHCR). And Packages: after the first build, make both packages (`daywise`, `daywise-worker`) visible to the repo or public so the server can pull; the workflow logs in with GITHUB_TOKEN which works for private packages owned by you.

**D8. First deploy**
Repo → Actions → "CI & Deploy" → latest run → Re-run all jobs. Watch `Deploy to KVM`.
Checks:
- https://daywise.smallsoftware.in/api/health → `{"ok":true}` over a valid certificate.
- `/login` → enter your email → magic link arrives from login@smallsoftware.in → `/app` loads.
- `/app/settings` → upload the SKTW logo → it renders (R2 works).

**D9. Branch cleanup**
GitHub → repo → Branches → delete `claude/sweet-carson-nm9bld`. ⚠ Done 12 Nov together with the Day 3/4 branches (`git push origin --delete …` after confirming `git rev-list --count origin/main..origin/<branch>` is 0).

---

## Part E — Day 2 acceptance (the gate for Day 3)
On your laptop with `.env.local` complete:
```
pnpm gen "5-day Kashmir couple mid-range"
pnpm gen "Kerala 6 days honeymoon"
pnpm gen "Dubai 4 days family of 4"
pnpm gen "Bali 7 days"
pnpm gen "Europe 10 days Paris Swiss"
```
For each, note the summary lines: provider, seconds, hotels verified / total, stops verified / total. Then the fallback test:
```
GROQ_API_KEY=bad pnpm gen "Goa 3 days"
```
The `AI:` line must name Gemini.

Paste the six summary lines as a comment on GitHub issue #2.

Pass criteria: Kashmir, Kerala, Dubai ≥ 80% hotels verified; median < 40 s; fallback proven. Anything else becomes a `bug` issue that Claude Code fixes at the start of Day 3.

---

## Decisions this runbook assumes
- Production stays on the Hostinger KVM **only if ports 80/443 are free** (D1). Otherwise escalate before continuing.
- Tenant subdomains `<slug>.daywise.smallsoftware.in` are kept; SKTW's CNAME is added on Day 6.
- Local and server use different `SESSION_SECRET` and `POSTGRES_PASSWORD`.
