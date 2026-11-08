// Usage: SESSION_TOKEN=$(pnpm exec tsx scripts/dev/mint-session.ts) node scripts/design-shots.mjs
// Requires `pnpm dev` on :3000. Writes docs/design/actual/*.png at 1440 and 390 for PNG comparison.
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

await shoot("07-itineraries-empty-1440", "/app", { ...D, authed: true });
await shoot("07-itineraries-empty-390", "/app", { ...M, authed: true });
await shoot("15-agency-settings-1440", "/app/settings", { ...D, authed: true });
await shoot("15-agency-settings-390", "/app/settings", { ...M, authed: true });
await shoot("16-superadmin-tenants-1440", "/admin", { ...D, authed: true });
await shoot("16-superadmin-tenants-390", "/admin", { ...M, authed: true });

await browser.close();
