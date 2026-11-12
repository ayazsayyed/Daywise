// Usage: SESSION_TOKEN=$(pnpm exec tsx scripts/dev/mint-session.ts) node scripts/design-shots.mjs
// Requires `pnpm dev` on :3000 (and ITINERARY_ID=<uuid> for the editor shots). Writes docs/design/actual/*.png at 1440 and 390 for PNG comparison.
// Screenshots every restyled screen at 1440 and 390 into docs/design/actual/.
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = process.env.OUT ?? new URL("../docs/design/actual", import.meta.url).pathname;
const SESSION = process.env.SESSION_TOKEN;
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
);

async function shoot(name, path, { width, height, authed = false, before, full = true }) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    ...(authed && SESSION
      ? {
          storageState: {
            cookies: [
              {
                name: "dw_session",
                value: SESSION,
                domain: "localhost",
                path: "/",
                httpOnly: true,
                secure: false,
                sameSite: "Lax",
                expires: Math.floor(Date.now() / 1000) + 86400,
              },
            ],
            origins: [],
          },
        }
      : {}),
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  // Hide the Next.js dev-tools badge so it does not land in the comparison shots.
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  if (before) await before(page);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
  console.log("shot", name, page.url());
  await ctx.close();
}

const D = { width: 1440, height: 1032 };
const M = { width: 390, height: 844 };

await shoot("04-signin-1440", "/login", D);
await shoot("17-signin-390", "/login", M);
const sent = async (page) => {
  await page.fill("#email", "nikhil@shreekrishnatravelworld.com");
  await page.click("button[type=submit]");
  await page.waitForSelector("text=Check your inbox");
};
await shoot("05-signin-link-sent-1440", "/login", { ...D, before: sent });
await shoot("05-signin-link-sent-390", "/login", { ...M, before: sent });

if (process.env.EMPTY === "1") {
  // Only meaningful on a tenant with no itineraries.
  await shoot("07-itineraries-empty-1440", "/app", { ...D, authed: true });
  await shoot("07-itineraries-empty-390", "/app", { ...M, authed: true });
}
await shoot("15-agency-settings-1440", "/app/settings", { ...D, authed: true });
await shoot("15-agency-settings-390", "/app/settings", { ...M, authed: true });
await shoot("16-superadmin-tenants-1440", "/admin", { ...D, authed: true });
await shoot("16-superadmin-tenants-390", "/admin", { ...M, authed: true });

// Day 3 screens. List needs itineraries; editor needs ITINERARY_ID (any of the tenant's).
await shoot("06-itineraries-list-1440", "/app", { ...D, authed: true, full: false });
await shoot("18-itineraries-list-390", "/app", { ...M, authed: true, full: false });
await shoot("08-new-step1-describe-1440", "/app/new", { ...D, authed: true });
const brief = async (page) => {
  await page.fill(
    "#trip-request",
    "5-day Kashmir for a couple, mid-range. They want a shikara ride and snow at Gulmarg. Flying into Srinagar mid-March.",
  );
  await page.keyboard.press("Control+Enter");
  await page.waitForSelector("text=Check the brief", { timeout: 60_000 });
  await page.fill("#client", "Ananya & Rohit Kapoor");
};
await shoot("09-new-step2-brief-1440", "/app/new", { ...D, authed: true, before: brief });
const ID = process.env.ITINERARY_ID;
if (ID) {
  await shoot("11-editor-day1-1440", `/app/i/${ID}`, { ...D, authed: true, full: false });
  await shoot("19-mobile-editor-390", `/app/i/${ID}`, { ...M, authed: true, full: false });
  const swap = async (page) => {
    await page.locator("button:has-text('Swap')").first().click();
    await page.waitForSelector("[role=option]", { timeout: 20_000 });
    await page.locator("[role=option]").first().scrollIntoViewIfNeeded();
  };
  await shoot("13-editor-swap-1440", `/app/i/${ID}`, { ...D, authed: true, full: false, before: swap });
}

await browser.close();
