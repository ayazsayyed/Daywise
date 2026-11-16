#!/usr/bin/env node
/**
 * Marketing screenshots for the small-software site (src/assets/screens/).
 *
 * Runs against a LOCAL Daywise only (refuses any non-localhost BASE_URL) and the
 * local dev database. All data is made through the app's own UI: a made-up
 * agency "Blue Hills Travels", the Mehta family, one Kerala request.
 *
 * Start the app first (production build, so no Next.js dev indicator):
 *   pnpm build && pnpm start          # terminal 1, with real AI + Places keys
 *   pnpm worker                       # terminal 2 (generation + PDF)
 *
 * Then run phases in order (each is safe to re-run):
 *   node scripts/marketing-screens.mjs setup      # tenant via /admin, branding via Settings
 *   node scripts/marketing-screens.mjs request    # prompt.png, brief.png
 *   node scripts/marketing-screens.mjs generate   # brief → generate → price ₹1,48,000
 *   node scripts/marketing-screens.mjs capture    # the other nine
 *   node scripts/marketing-screens.mjs all
 *
 * Env: BASE_URL (default http://localhost:3000). With APP_URL on localhost/127.0.0.1 the app
 *   shows share links as localhost. To show the tenant's custom domain instead, start the app
 *   with APP_URL=https://127.0.0.2:3443 behind a self-signed HTTPS proxy listening on
 *   127.0.0.2:3443 (the session cookie is Secure in production mode), start the worker with
 *   INTERNAL_APP_URL=http://localhost:3000, and pass BASE_URL=https://127.0.0.2:3443. OUT (default
 * ../small-software/src/assets/screens), DATABASE_URL (else read from
 * .env.local / .env), SUPERADMIN_EMAIL (same), CURSOR=0 to skip the drawn
 * pointer in editor-drag.png.
 *
 * Sign-in uses the real magic-link route: a one-time login token is written to
 * the dev database (as the e2e tests do) and /auth/verify is opened.
 */
import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium, devices } from "playwright";
import postgres from "postgres";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// ── Config ───────────────────────────────────────────────────────────────
function loadEnvFile(file) {
  const p = path.join(ROOT, file);
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && process.env[m[1]] === undefined)
      process.env[m[1]] = m[2].replace(/\s+#.*$/, "").replace(/^"(.*)"$/, "$1");
  }
}
loadEnvFile(".env.local");
loadEnvFile(".env");

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
if (!/^https?:\/\/(localhost|127\.0\.0\.\d+)(:\d+)?$/.test(BASE)) {
  console.error(`Refusing to run against ${BASE}: local development only.`);
  process.exit(2);
}
const DB_URL = process.env.DATABASE_URL;
if (!DB_URL || !/@(localhost|127\.0\.0\.1)[:/]/.test(DB_URL)) {
  console.error("DATABASE_URL must point at a local development database.");
  process.exit(2);
}
const SUPERADMIN = (process.env.SUPERADMIN_EMAIL ?? "").toLowerCase();
const OUT = path.resolve(
  process.env.OUT ?? path.join(ROOT, "..", "small-software/src/assets/screens"),
);
const DRAW_CURSOR = process.env.CURSOR !== "0";

const AGENCY = {
  name: "Blue Hills Travels",
  slug: "bluehills",
  owner: "owner@bluehillstravels.test", // .test: never receives mail
  domain: "itinerary.bluehillstravels.in",
  color: "#9A4A0B",
  phone: "+91 90000 00000",
};
const REQUEST = "6-day Kerala, family of 4, houseboat, about ₹1.5L";
const CLIENT = "Mehta family";
const TRIP = {
  start: "2026-12-12",
  nights: 5,
  adults: 2,
  children: 2,
  route: "Kochi, Munnar, Thekkady, Alleppey, Kochi",
  price: "148000",
};

const LOCALE = { locale: "en-IN", timezoneId: "Asia/Kolkata", colorScheme: "light" };
const DESKTOP = { viewport: { width: 1200, height: 750 }, deviceScaleFactor: 2, ...LOCALE };

// ── Helpers ──────────────────────────────────────────────────────────────
const sql = postgres(DB_URL, { max: 2, onnotice: () => {} });

async function signIn(context, email) {
  const token = randomBytes(32).toString("base64url");
  await sql`insert into login_tokens (email, token_hash, expires_at)
            values (${email}, ${createHash("sha256").update(token).digest("hex")}, now() + interval '15 minutes')`;
  const page = await context.newPage();
  await page.goto(`${BASE}/auth/verify?token=${encodeURIComponent(token)}`);
  await page.waitForURL(/\/(app|admin)/);
  return page;
}

/** Fonts loaded, every on-screen image decoded, network quiet, no spinners. */
async function settle(page, extraMs = 400) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.evaluate(async () => {
    await document.fonts.ready;
    const inView = (img) => {
      const r = img.getBoundingClientRect();
      return (
        r.width > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth
      );
    };
    const imgs = Array.from(document.images).filter(inView);
    await Promise.all(
      imgs.map((img) =>
        img.complete && img.naturalWidth > 0
          ? img.decode().catch(() => {})
          : new Promise((r) => {
              img.addEventListener("load", r, { once: true });
              img.addEventListener("error", r, { once: true });
              setTimeout(r, 20_000);
            }),
      ),
    );
  });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(extraMs);
}

/** Fails loudly if anything we must never ship is on screen. */
async function guard(page, name, { client = false } = {}) {
  const text = `${await page.title()}\n${await page.locator("body").innerText()}`;
  const banned = [/Shree Krishna/i, /SKTW/i, /shreekrishna/i, /localhost/i];
  if (client) banned.push(/Daywise/);
  for (const re of banned) if (re.test(text)) throw new Error(`${name}: found ${re} on screen`);
  for (const re of [/★/, /\brating\b/i, /\breviews?\b/i])
    if (re.test(text)) console.warn(`  ! ${name}: ${re} appears on screen — check`);
  const brokenImgs = await page.evaluate(
    () =>
      Array.from(document.images).filter((i) => {
        const r = i.getBoundingClientRect();
        const visible =
          r.width > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
        return visible && (!i.complete || i.naturalWidth === 0);
      }).length,
  );
  if (brokenImgs) throw new Error(`${name}: ${brokenImgs} visible image(s) not loaded`);
}

/** Writes a PNG at exactly w×h, converting/cropping with ImageMagick only if needed (never upscales). */
function finalise(src, name, w, h) {
  const dst = path.join(OUT, name);
  const [sw, sh] = execFileSync("identify", ["-format", "%w %h", src], { encoding: "utf8" })
    .trim()
    .split(" ")
    .map(Number);
  if (sw < w || sh < h) throw new Error(`${name}: source ${sw}×${sh} smaller than ${w}×${h}`);
  execFileSync("convert", [
    src,
    ...(sw === w && sh === h
      ? []
      : ["-resize", `${w}x${h}^`, "-gravity", "center", "-extent", `${w}x${h}`]),
    "-strip",
    "-colorspace",
    "sRGB",
    `PNG24:${dst}`,
  ]);
  const size = execFileSync("identify", ["-format", "%wx%h", dst], { encoding: "utf8" }).trim();
  console.log(`  ✓ ${name} ${size}`);
}

const tmp = (n) => path.join(os.tmpdir(), `mkt-${process.pid}-${n}`);

async function shot(page, name, w, h, opts = {}) {
  await settle(page);
  await guard(page, name, opts);
  const file = tmp(name);
  await page.screenshot({ path: file, clip: opts.clip, animations: "disabled", caret: "hide" });
  finalise(file, name, w, h);
}

async function tenant() {
  const [t] = await sql`select id, slug from tenants where slug = ${AGENCY.slug}`;
  return t ?? null;
}

async function itinerary(t) {
  const [it] = await sql`select id from itineraries
    where tenant_id = ${t.id} and deleted_at is null and title ilike ${"%" + CLIENT + "%"}
    order by created_at desc limit 1`;
  return it ?? null;
}

// ── Phases ───────────────────────────────────────────────────────────────
async function setup(browser) {
  console.log("setup");
  if (!(await tenant())) {
    if (!SUPERADMIN) throw new Error("SUPERADMIN_EMAIL is not set");
    const ctx = await browser.newContext(DESKTOP);
    const page = await signIn(ctx, SUPERADMIN);
    await page.goto(`${BASE}/admin`);
    await page.waitForTimeout(1000); // hydration
    const card = page.getByRole("region", { name: "Create tenant" });
    await card.getByLabel("Agency name").fill(AGENCY.name);
    await card.getByLabel("Subdomain").fill(AGENCY.slug);
    await card.getByLabel("Owner email").fill(AGENCY.owner);
    await card.getByLabel("Custom domain").fill(AGENCY.domain);
    await card.getByLabel("Plan").selectOption("standard");
    await card.getByRole("button", { name: "Create tenant" }).click();
    await card.getByText(`${AGENCY.name} created`).waitFor();
    await ctx.close();
    console.log("  created tenant via /admin");
  }
  const ctx = await browser.newContext(DESKTOP);
  const page = await signIn(ctx, AGENCY.owner);
  await page.goto(`${BASE}/app/settings`);
  await page.waitForTimeout(1000);
  await page.getByLabel("Theme colour hex").fill(AGENCY.color);
  await page.getByLabel("Phone", { exact: true }).fill(AGENCY.phone);
  await page.getByLabel("WhatsApp", { exact: true }).fill(AGENCY.phone);
  await page.getByLabel("Email", { exact: true }).fill("");
  const save = page.getByRole("button", { name: "Save changes" });
  if (await save.isEnabled()) await save.click(); // disabled = nothing changed
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500);
  const [b] = await sql`select branding from tenants where slug = ${AGENCY.slug}`;
  if (b?.branding.theme_color !== AGENCY.color || b?.branding.phone !== AGENCY.phone)
    throw new Error("Settings did not save the Blue Hills branding");
  console.log("  branding saved via Settings");
  await ctx.close();
}

async function request(browser) {
  console.log("request");
  const ctx = await browser.newContext(DESKTOP);
  const page = await signIn(ctx, AGENCY.owner);
  await page.goto(`${BASE}/app/new`);
  await page.waitForTimeout(800);
  await page.getByRole("textbox").first().fill(REQUEST);
  await page.mouse.move(0, 0);
  await shot(page, "prompt.png", 2400, 1500);

  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Client name").waitFor({ timeout: 90_000 });
  await page.getByLabel("Client name").fill(CLIENT);
  await page.getByLabel("Client name").blur();
  // Bring the pace row (last brief field) into view; the top of the card scrolls as needed.
  // Start at the "N details were assumed" line (no half-cut text under the 56px bar).
  const pace = await page.getByRole("radiogroup", { name: "Pace" }).boundingBox();
  const notice = await page.getByText(/details? (was|were) assumed/).boundingBox();
  const y = await page.evaluate(() => window.scrollY);
  const minTop = y + pace.y + pace.height + 12 - 750;
  const top = Math.max(minTop, y + (notice ? notice.y - 80 : 0));
  await page.evaluate((t) => window.scrollTo(0, Math.max(0, t)), top);
  await shot(page, "brief.png", 2400, 1500);
  await ctx.close();
}

async function generate(browser) {
  console.log("generate");
  const ctx = await browser.newContext(DESKTOP);
  const page = await signIn(ctx, AGENCY.owner);
  await page.goto(`${BASE}/app/new`);
  await page.waitForTimeout(800);
  await page.getByRole("textbox").first().fill(REQUEST);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Client name").waitFor({ timeout: 90_000 });
  await page.getByLabel("Client name").fill(CLIENT);
  await page.locator("#adults").fill(String(TRIP.adults));
  await page.locator("#children").fill(String(TRIP.children));
  await page.getByLabel("Route").fill(TRIP.route);
  await page.locator("#start").fill(TRIP.start);
  await page.locator("#nights").fill(String(TRIP.nights));
  await page.locator("#entry").fill("Kochi");
  await page.locator("#exit").fill("Kochi");
  await page.getByRole("radiogroup", { name: "Budget tier" }).getByText("Mid-range").click();
  await page.getByRole("radiogroup", { name: "Pace" }).getByText("Relaxed").click();
  await page.getByRole("button", { name: "Generate itinerary" }).click();
  await page.waitForURL(/\/app\/i\/[0-9a-f-]{36}$/, { timeout: 240_000 });
  await page.waitForTimeout(1500);

  // Price: total for 4, shown to the client.
  await page.getByRole("radiogroup", { name: "Pricing mode" }).getByText("Total").click();
  await page.getByLabel("Total price").fill(TRIP.price);
  await page.getByLabel("Total price").blur();
  const show = page.getByRole("switch", { name: "Show price on shared itinerary" });
  if ((await show.getAttribute("aria-checked")) !== "true") await show.click();
  await page.getByText(/Saved/).first().waitFor({ timeout: 15_000 });
  console.log(`  itinerary ${page.url().split("/").pop()}`);
  await ctx.close();
}

async function capture(browser) {
  console.log("capture");
  const t = await tenant();
  const it = t && (await itinerary(t));
  if (!it) throw new Error("No Mehta family itinerary yet: run the generate phase");
  const ctx = await browser.newContext(DESKTOP);
  const page = await signIn(ctx, AGENCY.owner);
  const editorUrl = `${BASE}/app/i/${it.id}`;

  // editor-desktop.png — Day 1 at the top with its hotel card, price panel on the right.
  await page.goto(editorUrl);
  await page.mouse.move(0, 0);
  await shot(page, "editor-desktop.png", 2400, 1500);

  // demo-poster.png — the same editor framed at 960×540.
  {
    const p = await (
      await browser.newContext({
        ...DESKTOP,
        viewport: { width: 960, height: 540 },
        storageState: await ctx.storageState(),
      })
    ).newPage();
    await p.goto(editorUrl);
    await p.mouse.move(0, 0);
    await shot(p, "demo-poster.png", 1920, 1080);
    await p.context().close();
  }

  // Crops render at 3x so a tight clip (under 800 CSS px wide) still downsizes to 1600×1000.
  const crop = await browser.newContext({
    ...DESKTOP,
    deviceScaleFactor: 3,
    storageState: await ctx.storageState(),
  });
  const cp = await crop.newPage();
  await cp.goto(editorUrl);
  await settle(cp);

  // hotel-verified.png — the first day whose hotel carries the Verified badge, cropped to the card.
  {
    const days = cp.locator("section[aria-label^='Day ']");
    let card = null;
    for (let i = 0; i < (await days.count()); i++) {
      const badge = days.nth(i).getByText("Verified", { exact: true });
      if (await badge.count()) {
        card = badge
          .first()
          .locator(
            "xpath=ancestor::div[contains(@class,'rounded-lg') and contains(@class,'bg-surface-sunken')][1]",
          );
        break;
      }
    }
    if (!card) console.warn("  - hotel-verified.png skipped: no day has a verified hotel");
    else {
      const pad = 28;
      let b = await card.boundingBox();
      const w = b.width + pad * 2;
      const h = w / 1.6;
      const day = card.locator("xpath=ancestor::section[starts-with(@aria-label,'Day ')][1]");
      const lastStop = day
        .getByRole("button", { name: /^Drag / })
        .last()
        .locator("xpath=ancestor::li[1]");
      // Top edge just above the day's last stop row (no half-cut line); the card sits below it.
      await cp.evaluate((dy) => window.scrollBy(0, dy), b.y + b.height + pad - 720);
      await cp.waitForTimeout(300);
      b = await card.boundingBox();
      const sb = await lastStop.boundingBox();
      let y = b.y + b.height + pad - h;
      if (sb && sb.y - 12 > y && sb.y - 12 + h >= b.y + b.height + 12) y = sb.y - 12;
      const clip = { x: b.x - pad, y, width: w, height: h };
      await shot(cp, "hotel-verified.png", 1600, 1000, { clip });
    }
  }

  // price-modes.png — the Pricing section from hairline to hairline, a day photo beside it.
  {
    const block = cp
      .getByRole("radiogroup", { name: "Pricing mode" })
      .locator("xpath=ancestor::section[1]");
    let bb = await block.boundingBox();
    const h = bb.height;
    const w = h * 1.6;
    const vp = cp.viewportSize();
    const clipY = 56 + (vp.height - 56 - h) / 2;
    // Window: put Day 2's hero photo top just above the clip (its caption sits below the clip).
    const hero = cp.locator("section[aria-label^='Day 2'] figure img").first();
    const hb = await hero.boundingBox();
    await cp.evaluate((dy) => window.scrollBy(0, dy), hb.y - (clipY - 16));
    // Side panel has its own scroll: put the Pricing section at the clip.
    await cp.evaluate((dy) => {
      document.querySelector("aside").scrollTop += dy;
    }, bb.y - clipY);
    await cp.waitForTimeout(300);
    bb = await block.boundingBox();
    const clip = { x: vp.width - w, y: bb.y, width: w, height: h };
    await shot(cp, "price-modes.png", 1600, 1000, { clip });
  }
  await crop.close();

  // editor-drag.png — Day 1's last stop lifted over Day 2's stop list (the editor auto-scrolls
  // while dragging). The pointer is drawn at the real mouse position (headless has none).
  {
    await page.goto(editorUrl);
    await settle(page);
    const day1 = page.locator("section[aria-label^='Day 1']");
    const handle = day1.getByRole("button", { name: /^Drag / }).last();
    await handle.scrollIntoViewIfNeeded();
    const hb = await handle.boundingBox();
    const sx = hb.x + hb.width / 2;
    const sy = hb.y + hb.height / 2;
    await page.mouse.move(sx, sy);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) await page.mouse.move(sx + i * 2, sy + i * 8);
    // Hold near the bottom edge until Day 2's stop list is in view.
    const list2 = page.locator("section[aria-label^='Day 2'] ol[aria-label='Stops']");
    for (let i = 0; i < 80; i++) {
      await page.mouse.move(sx + 20, 742 - (i % 2));
      await page.waitForTimeout(100);
      const lb = await list2.boundingBox();
      if (lb && lb.y < 380) break;
    }
    const lb = await list2.boundingBox();
    const items = list2.locator("li");
    const second = (await items.count()) > 1 ? await items.nth(1).boundingBox() : lb;
    const tx = sx + 8;
    const ty = second.y + 6;
    for (let i = 1; i <= 15; i++)
      await page.mouse.move(sx + 20 + ((tx - sx - 20) * i) / 15, 740 + ((ty - 740) * i) / 15);
    await page.waitForTimeout(500);
    if (DRAW_CURSOR)
      await page.evaluate(
        ([x, y]) => {
          const c = document.createElement("div");
          c.id = "mkt-cursor";
          c.style.cssText = `position:fixed;left:${x}px;top:${y}px;z-index:2147483647;pointer-events:none;width:18px;height:24px`;
          c.innerHTML =
            '<svg viewBox="0 0 18 24" width="18" height="24"><path d="M1 1v19l5-5 3.5 7.5 3-1.4L9 13.7h7z" fill="#1C1B19" stroke="#F7F5F1" stroke-width="1.5" stroke-linejoin="round"/></svg>';
          document.body.appendChild(c);
        },
        [tx, ty],
      );
    const vp = page.viewportSize();
    // Left edge just outside the day's date column; top edge just under Day 2's hero photo.
    const sec2 = await page.locator("section[aria-label^='Day 2']").boundingBox();
    const hero2 = await page.locator("section[aria-label^='Day 2'] figure").first().boundingBox();
    let y = hero2 ? hero2.y + hero2.height + 12 : ty - 220;
    if (ty - y > 440 || ty < y) y = ty - 220;
    const clip = {
      x: Math.max(0, Math.min(sec2.x - 16, vp.width - 800)),
      y: Math.max(56, Math.min(y, vp.height - 500)),
      width: 800,
      height: 500,
    };
    await guard(page, "editor-drag.png");
    const file = tmp("drag.png");
    await page.screenshot({ path: file, clip, caret: "hide" });
    finalise(file, "editor-drag.png", 1600, 1000);
    await page.evaluate(() => document.getElementById("mkt-cursor")?.remove());
    await page.keyboard.press("Escape"); // cancel: nothing is moved or saved
    await page.mouse.up();
  }

  // Share link: open it twice on a phone so the view count is not zero.
  await page.goto(editorUrl);
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "Share", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "Share itinerary" });
  const linkBox = panel.getByRole("textbox", { name: "Share link" });
  await linkBox.waitFor();
  for (let i = 0; i < 40 && !(await linkBox.inputValue()).includes("/s/"); i++)
    await page.waitForTimeout(250);
  const shareUrl = await linkBox.inputValue();
  const token = shareUrl.split("/s/")[1];
  const localShare = `${BASE}/s/${token}`;
  const phone = await browser.newContext({
    ...devices["iPhone 13"],
    ...LOCALE,
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  const client = await phone.newPage();
  await client.goto(localShare);
  await settle(client, 800);
  await guard(client, "client-mobile.png", { client: true });
  await shot(client, "client-mobile.png", 780, 1688, { client: true });
  const desk = await browser.newContext({
    ...LOCALE,
    viewport: { width: 1280, height: 800 },
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  });
  await (await desk.newPage()).goto(localShare);
  await desk.close();

  for (let i = 0; i < 20; i++) {
    const [v] = await sql`select view_count from share_links where token = ${token}`;
    if (v?.view_count > 0) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  const [views] = await sql`select view_count from share_links where token = ${token}`;
  if (!(views?.view_count > 0)) throw new Error("share link views were not recorded");

  // share-panel.png — reopen so the view count and last-viewed time are fresh.
  await page.reload();
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "Share", exact: true }).click();
  await panel.waitFor();
  await page.mouse.move(0, 0);
  await shot(page, "share-panel.png", 2400, 1500);

  // custom-domain.png — page only at 1600×880 (option 2); top 120 px left for the browser chrome.
  {
    const c = await browser.newContext({
      ...LOCALE,
      viewport: { width: 800, height: 440 },
      deviceScaleFactor: 2,
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    });
    const p = await c.newPage();
    await p.goto(localShare);
    await settle(p, 800);
    await guard(p, "custom-domain.png", { client: true });
    const file = tmp("domain.png");
    await p.screenshot({ path: file, caret: "hide" });
    execFileSync("convert", [
      file,
      "-background",
      "#FFFFFF",
      "-gravity",
      "south",
      "-extent",
      "1600x1000",
      "-strip",
      "-colorspace",
      "sRGB",
      `PNG24:${path.join(OUT, "custom-domain.png")}`,
    ]);
    console.log(
      "  ✓ custom-domain.png 1600x1000 (page 1600×880 at the bottom; top 120 px blank for the address bar)",
    );
    await c.close();
  }

  // pdf-page.png — the app's own Download PDF, page 2 at 150 dpi.
  {
    await page.reload();
    await page.waitForTimeout(1500);
    await page.getByRole("button", { name: "Share", exact: true }).click();
    const dl = page.waitForEvent("download", { timeout: 120_000 });
    await panel.getByRole("button", { name: /Download PDF/ }).click();
    const pdf = tmp("itinerary.pdf");
    await (await dl).saveAs(pdf);
    const text = execFileSync("pdftotext", [pdf, "-"], { encoding: "utf8" });
    for (const re of [/Daywise/, /Shree Krishna/i, /localhost/i])
      if (re.test(text)) throw new Error(`PDF contains ${re}`);
    const base = tmp("pdfpage");
    execFileSync("pdftoppm", ["-f", "2", "-l", "2", "-r", "150", "-png", "-singlefile", pdf, base]);
    finalise(`${base}.png`, "pdf-page.png", 1240, 1754);
  }
  await phone.close();
  await ctx.close();
}

// ── Main ─────────────────────────────────────────────────────────────────
const phase = process.argv[2] ?? "all";
fs.mkdirSync(OUT, { recursive: true });
// Native date inputs follow Chromium's UI language, taken from LANGUAGE (DD/MM/YYYY for en-IN).
// A loopback BASE_URL other than localhost/127.0.0.1 (see the header) is served
// through a self-signed local HTTPS proxy: accept its certificate, skip the outbound proxy.
const viaTlsProxy = BASE.startsWith("https://");
const browser = await chromium.launch({
  args: [
    "--lang=en-IN",
    ...(viaTlsProxy ? ["--ignore-certificate-errors", "--no-proxy-server"] : []),
  ],
  env: { ...process.env, LANGUAGE: "en_IN", LANG: "en_IN.UTF-8" },
});
try {
  if (phase === "setup" || phase === "all") await setup(browser);
  if (phase === "request" || phase === "all") await request(browser);
  if (phase === "generate" || phase === "all") await generate(browser);
  if (phase === "capture" || phase === "all") await capture(browser);
} finally {
  await browser.close();
  await sql.end();
}
