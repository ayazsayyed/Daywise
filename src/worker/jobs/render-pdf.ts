import { and, eq, lt } from "drizzle-orm";
import { chromium, type Browser } from "playwright";

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
      const pdf = await page.pdf({ format: "A4", preferCSSPageSize: true, printBackground: true });
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

/** Drops PDFs nobody downloaded (and failed rows) after 10 minutes. */
export async function sweepPdfJobs(): Promise<number> {
  const rows = await db
    .delete(schema.pdfJobs)
    .where(and(lt(schema.pdfJobs.createdAt, new Date(Date.now() - PDF_TTL_MS))))
    .returning({ id: schema.pdfJobs.id });
  return rows.length;
}
