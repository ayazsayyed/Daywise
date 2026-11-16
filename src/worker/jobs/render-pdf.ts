import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { and, eq, lt } from "drizzle-orm";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

import { A4_MM, PX_PER_MM } from "@/features/pdf/constants";
import { PRINT_PARTS, type PrintPart } from "@/features/pdf/geometry";
import { mergeParts, type ResolvedStamp } from "@/features/pdf/merge";
import {
  resolveStyleMeta as resolveStyle,
  type StyleMeta as PdfStyle,
} from "@/features/pdf/styles/meta";
import { buildTokens, type PdfTokens } from "@/features/pdf/tokens";
import {
  fitHeroWidth,
  PRINT_CONTENT_HEIGHT_PX,
  PRINT_CONTENT_WIDTH_PX,
  type HeroBlock,
} from "@/features/share/print-fit";
import { printSignature } from "@/features/share/print-sign";
import { db, schema } from "@/lib/db";
import { DEFAULT_BRANDING, tenantBrandingSchema } from "@/lib/db/json";
import { mintShareToken } from "@/lib/db/share";
import { tenantScope } from "@/lib/db/tenant";
import { env } from "@/lib/env";
import { logger as base } from "@/lib/logger";

/**
 * pg-boss `render-pdf`. Chromium prints Daywise's own print pages:
 * - Editorial (single document): `/s/<token>?print=1&sig=…`, as before styles.
 * - Other styles: three documents (`&part=cover|body|last`), merged with
 *   pdf-lib and stamped with page numbers (src/features/pdf/merge.ts).
 * Settings "Preview PDF" prints `/s/preview/<tenantId>` (sample fixture).
 * Bytes go to `pdf_jobs` for one download, never to a file or R2.
 */
export type RenderPdfData = { jobId: string; tenantId: string };

const logger = base.child({ job: "render-pdf" });
const PDF_TTL_MS = 10 * 60_000;
const A4_WIDTH_PX = A4_MM.w * PX_PER_MM;

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

let stampFont: Promise<Uint8Array> | null = null;
const loadStampFont = () =>
  (stampFont ??= readFile(join(process.cwd(), "src/features/pdf/fonts/Inter-500.woff")).then(
    (b) => new Uint8Array(b),
  ));

/** The print URL for a job (shared itinerary or settings preview). */
export async function printBaseUrl(job: {
  tenantId: string;
  itineraryId: string | null;
  preview: boolean;
}): Promise<string> {
  const origin = (env.INTERNAL_APP_URL ?? env.APP_URL).replace(/\/$/, "");
  if (job.preview || !job.itineraryId) {
    const sig = printSignature(`preview:${job.tenantId}`, env.SESSION_SECRET);
    return `${origin}/s/preview/${job.tenantId}?print=1&sig=${sig}`;
  }
  const link = await tenantScope(job.tenantId).ensureShareLink(job.itineraryId, mintShareToken);
  return `${origin}/s/${link.token}?print=1&sig=${printSignature(link.token, env.SESSION_SECRET)}`;
}

/** Style + stamp colour for a tenant (the print pages resolve the same style). */
async function styleFor(tenantId: string): Promise<{ style: PdfStyle; tokens: PdfTokens }> {
  const tenant = await db.query.tenants.findFirst({ where: eq(schema.tenants.id, tenantId) });
  if (!tenant) throw new Error("tenant not found");
  const parsed = tenantBrandingSchema.safeParse(tenant.branding);
  const b = parsed.success ? parsed.data : { ...DEFAULT_BRANDING, ...tenant.branding };
  const style = resolveStyle(tenant.pdfStyle, tenant.id);
  const tokens = buildTokens({
    primary: b.theme_color,
    accent: tenant.accentColor,
    titleFont: tenant.titleFont === "serif" ? "serif" : "inter",
  });
  return { style, tokens };
}

function resolveStamp(style: PdfStyle, tokens: PdfTokens): ResolvedStamp | null {
  if (!style.stamp) return null;
  const c = style.stamp.color;
  const color = c.startsWith("#")
    ? c
    : ((tokens as unknown as Record<string, string>)[c] ?? tokens.ink);
  return { ...style.stamp, color };
}

export type RenderResult = { pdf: Buffer; pages: number; parts?: Record<PrintPart, number> };

/**
 * Renders a full PDF from a print base URL. Exported for the golden-render
 * script; the job handler below adds the pdf_jobs bookkeeping.
 */
export async function renderPdf(
  baseUrl: string,
  tenantId: string,
  styleOverride?: string,
): Promise<RenderResult> {
  const { style: tenantStyle, tokens } = await styleFor(tenantId);
  const style = styleOverride ? resolveStyle(styleOverride, tenantId) : tenantStyle;
  const url = styleOverride ? `${baseUrl}&style=${encodeURIComponent(styleOverride)}` : baseUrl;
  const ctx = await (
    await getBrowser()
  ).newContext({
    viewport: { width: 794, height: 1123 },
    deviceScaleFactor: 1,
    userAgent: "DaywisePDF/1.0 (headless; print)",
  });
  try {
    if (style.singleDocument) {
      const pdf = await printPage(ctx, url, {
        widthPx: PRINT_CONTENT_WIDTH_PX,
        heightPx: PRINT_CONTENT_HEIGHT_PX,
      });
      return { pdf, pages: countPdfPages(pdf) };
    }
    const zone = {
      widthPx: A4_WIDTH_PX,
      heightPx: (A4_MM.h - style.insets.top - style.insets.bottom) * PX_PER_MM,
    };
    const [cover, body, last] = await Promise.all(
      PRINT_PARTS.map((part) =>
        printPage(ctx, `${url}&part=${part}`, part === "body" ? zone : null),
      ),
    );
    const merged = await mergeParts({
      cover: cover!,
      body: body!,
      last: last!,
      stamp: resolveStamp(style, tokens),
      font: await loadStampFont(),
    });
    return {
      pdf: Buffer.from(merged.pdf),
      pages: merged.pages,
      parts: {
        cover: countPdfPages(cover!),
        body: countPdfPages(body!),
        last: countPdfPages(last!),
      },
    };
  } finally {
    await ctx.close();
  }
}

async function printPage(
  ctx: BrowserContext,
  url: string,
  fit: { widthPx: number; heightPx: number } | null,
): Promise<Buffer> {
  const page = await ctx.newPage();
  try {
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
    if (fit) await fitHeroesToPages(page, fit);
    return await page.pdf({ format: "A4", preferCSSPageSize: true, printBackground: true });
  } finally {
    await page.close();
  }
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
    const url = await printBaseUrl(job);
    const { pdf, pages } = await renderPdf(url, job.tenantId);
    const ms = Date.now() - started;
    await set({ status: "done", pdf, bytes: pdf.length, pages, ms, error: null });
    // Settings previews are not counted against the PDF cap.
    if (!job.preview)
      await db.insert(schema.usageEvents).values({
        tenantId: job.tenantId,
        kind: "pdf",
        costUnits: 1,
        meta: { itinerary_id: job.itineraryId ?? undefined, pages, bytes: pdf.length, ms },
      });
    logger.info(
      { jobId: job.id, pages, bytes: pdf.length, ms, preview: job.preview },
      "pdf rendered",
    );
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
 * Lays the page out at print width and narrows the cover and day heroes just
 * enough for each block to fit one page (#19). Two passes: a narrower hero
 * can re-wrap its caption. `heightPx` is the content height of one page.
 */
async function fitHeroesToPages(page: Page, fit: { widthPx: number; heightPx: number }) {
  await page.setViewportSize({ width: Math.round(fit.widthPx), height: 1123 });
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
    const widths = blocks.map((b) => fitHeroWidth(b, { pageHeight: fit.heightPx }));
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
