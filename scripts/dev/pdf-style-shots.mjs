// Usage: SESSION_TOKEN=$(pnpm exec tsx scripts/dev/mint-session.ts) BASE_URL=http://localhost:3101 node scripts/dev/pdf-template-shots.mjs
// Screenshots Settings (with the PDF section and preview) at 1440 and 390 into docs/design/actual/ (no PNG exists for the PDF section).
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = process.env.OUT ?? new URL("../../docs/design/actual", import.meta.url).pathname;
const SESSION = process.env.SESSION_TOKEN;
if (!SESSION) throw new Error("SESSION_TOKEN is required");
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
for (const [name, viewport] of [
  ["15b-settings-pdf-1440", { width: 1440, height: 1100 }],
  ["15b-settings-pdf-390", { width: 390, height: 844 }],
]) {
  const ctx = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    storageState: {
      cookies: [
        {
          name: "dw_session",
          value: SESSION,
          domain: new URL(BASE).hostname,
          path: "/",
          httpOnly: true,
          secure: false,
          sameSite: "Lax",
          expires: Math.floor(Date.now() / 1000) + 86400,
        },
      ],
      origins: [],
    },
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/app/settings`, { waitUntil: "networkidle" });
  // Sticky top bar would overlap an element shot; let it scroll away.
  await page.addStyleTag({
    content: "nextjs-portal { display: none !important; } header { position: static !important; }",
  });
  await page.evaluate(() => document.fonts.ready);
  // Full page: the PDF fields sit in the form, the live preview in the right column.
  await page.locator('section[aria-label="PDF"]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  console.log("shot", name);
  await ctx.close();
}
await browser.close();
