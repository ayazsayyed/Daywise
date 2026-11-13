import { and, eq, lt } from "drizzle-orm";
import { chromium, type Browser, type Page } from "playwright";

import {
  fitHeroWidth,
  PRINT_CONTENT_WIDTH_PX,
  type HeroBlock,
} from "@/features/share/print-fit";
import { printSignature } from "@/features/share/print-sign";
import { db, schema } from "@/lib/db";
import { mintShareToken } from "@/lib/db/share";
import { tenantScope } from "@/lib/db/tenant";
import { env } from "@/lib/env";
import { logger as base } from "@/lib/logger";

/**
 * pg-boss `render-pdf`: Chromium prints the client page itself
 * (`/s/<token>?print=1&sig=…`), so the PDF is the page — built once, printed
 * from it. The bytes go to `pdf_jobs` for one download, never to a file or R2.
 */
export type RenderPdfData = { jobId: string; tenantId: string };

const logger = base.child({ job: "render-pdf" });
const PDF_TTL_MS = 10 * 60_000;

let browser: Promise<Browser> | null = null;
function getBrowser(): Promise<Browser> {
  browser ??= chromium.launch({ args: ["--disable-dev-shm-usage"] }).then((b) => {
    b.on("disconnected", () => (browser = null));
    return b;
  });
  return browser;
}

/** Launch Chromium at worker start so the first PDF of the day is not a cold start. */
export function warmPdfBrowser() {
  void getBrowser().catch((err) => logger.warn({ err }, "chromium not available"));
}

export async function closePdfBrowser() {
  const b = await browser?.catch(() => null);
  browser = null;
  await b?.close().catch(() => undefined);
}

/** "/Type /Page" objects (not "/Pages") in the PDF. */
export function countPdfPages(pdf: Buffer): number {
  return (pdf.toString("latin1").match(/\/Type\s*\/Page(?![s\w])/g) ?? []).length;
}

export async function handleRenderPdf(data: RenderPdfData): Promise<void> {
  const job = await db.query.pdfJobs.findFirst({ where: eq(schema.pdfJobs.id, data.jobId) });
  if (!job || job.tenantId !== data.tenantId || job.status !== "queued") return;
  const started = Date.now();
  const set = (patch: Partial<typeof schema.pdfJobs.$inferInsert>) =>
    db
      .update(schema.pdfJobs)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(schema.pdfJobs.id, job.id));

  await set({ status: "rendering" });
  try {
    const link = await tenantScope(job.tenantId).ensureShareLink(job.itineraryId, mintShareToken);
    const origin = (env.INTERNAL_APP_URL ?? env.APP_URL).replace(/\/$/, "");
    const url = `${origin}/s/${link.token}?print=1&sig=${printSignature(link.token, env.SESSION_SECRET)}`;

    const ctx = await (
      await getBrowser()
    ).newContext({
      viewport: { width: 794, height: 1123 },
      deviceScaleFactor: 1,
      userAgent: "DaywisePDF/1.0 (headless; print)",
    });
    try {
      const page = await ctx.newPage();
      const res = await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
      if (!res || !res.ok()) throw new Error(`print page returned ${res?.status() ?? "nothing"}`);
      await page.emulateMedia({ media: "print" });
      // Lazy images and webfonts must be in before printing.
      await page.evaluate(async () => {
        document.querySelectorAll("img").forEach((img) => (img.loading = "eager"));
        await Promise.all(
          Array.from(document.images).map((img) =>
            img.complete
              ? null
              : new Promise((r) => {
                  img.onload = img.onerror = r;
                }),
          ),
        );
        await document.fonts.ready;
      });
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
      await fitHeroesToPages(page);
      const pdf =await page.pdf({ format: "A4", preferCSSPageSize: true, printBackground: true });
      const pages = countPdfPages(pdf);
      const ms = Date.now() - started;
      await set({ status: "done", pdf, bytes: pdf.length, pages, ms, error: null });
      await db.insert(schema.usageEvents).values({
        tenantId: job.tenantId,
        kind: "pdf",
        costUnits: 1,
        meta: { itinerary_id: job.itineraryId, pages, bytes: pdf.length, ms },
      });
      logger.info({ jobId: job.id, pages, bytes: pdf.length, ms }, "pdf rendered");
    } finally {
      await ctx.close();
    }
  } catch (err) {
    logger.error({ err, jobId: job.id }, "pdf render failed");
    await set({
      status: "failed",
      error: "The PDF could not be prepared. Please try again.",
      ms: Date.now() - started,
    });
  }
}

/**
 * Lays the page out at the A4 content width and narrows the cover and day
 * heroes just enough for each block to fit one page (#19). Two passes: a
 * narrower hero can re-wrap its caption.
 */
async function fitHeroesToPages(page: Page) {
  await page.setViewportSize({ width: Math.round(PRINT_CONTENT_WIDTH_PX), height: 1123 });
  for (let pass = 0; pass < 2; pass++) {
    const blocks: HeroBlock[] = await page.evaluate(() =>
      [
        document.querySelector<HTMLElement>(".share-cover"),
        ...Array.from(document.querySelectorAll<HTMLElement>(".share-day")),
      ].map((el) => {
        const hero = el?.querySelector<HTMLElement>("figure.photo > div");
        if (!el || !hero) return { blockHeight: 0, frameWidth: 0, frameHeight: 0, columnWidth: 0 };
        const box = el.getBoundingClientRect();
        const frame = hero.getBoundingClientRect();
        // The cover shares page 1 with the header, so measure it from the top of the document.
        const top = el.classList.contains("share-cover") ? -window.scrollY : box.top;
        return {
          blockHeight: box.bottom - top,
          frameWidth: frame.width,
          frameHeight: frame.height,
          columnWidth: box.width,
        };
      }),
    );
    const widths = blocks.map((b) => fitHeroWidth(b));
    if (widths.every((w) => w === null)) return;
    await page.evaluate((ws) => {
      [
        document.querySelector<HTMLElement>(".share-cover"),
        ...Array.from(document.querySelectorAll<HTMLElement>(".share-day")),
      ].forEach((el, i) => {
        const fig = el?.querySelector<HTMLElement>("figure.photo");
        if (fig && ws[i] != null) fig.style.width = `${ws[i]}px`;
      });
    }, widths);
  }
}

/** Drops PDFs nobody downloaded (and failed rows) after 10 minutes. */
export async function sweepPdfJobs(): Promise<number> {
  const rows = await db
    .delete(schema.pdfJobs)
    .where(and(lt(schema.pdfJobs.createdAt, new Date(Date.now() - PDF_TTL_MS))))
    .returning({ id: schema.pdfJobs.id });
  return rows.length;
}
