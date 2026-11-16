import "../load-env";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { eq } from "drizzle-orm";
import { PDFDocument } from "pdf-lib";

import { BUILT_IN_META as BUILT_IN_STYLES } from "@/features/pdf/styles/meta";
import { closeDb, db, schema } from "@/lib/db";
import { closePdfBrowser, printBaseUrl, renderPdf } from "@/worker/jobs/render-pdf";

/**
 * Golden renders (Part 2 "PDF styles" verification): every built-in style ×
 * {2, 5, 12 days} × {priced, hidden} with the sample fixture, through the same
 * print pages and merge as the worker. Needs the app running at APP_URL.
 *   pnpm exec tsx scripts/dev/pdf-golden.ts <tenant-slug> [outDir] [--styles a,b] [--days 2,5,12]
 *     [--pricing priced,hidden] [--itinerary <id>]  (a real itinerary instead of the fixture)
 * Writes <outDir>/<style>-<days>d-<priced|hidden>.pdf and prints a JSON report.
 */
async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("not for production");
  const args = process.argv.slice(2);
  const slug = args[0] ?? "sktw";
  const out = args[1] && !args[1].startsWith("--") ? args[1] : "/tmp/daywise-golden";
  const flag = (name: string) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1]!.split(",") : null;
  };
  const styles = flag("styles") ?? BUILT_IN_STYLES.map((s) => s.id);
  const dayCounts = (flag("days") ?? ["2", "5", "12"]).map(Number);
  const pricing = flag("pricing") ?? ["priced", "hidden"];

  const tenant = await db.query.tenants.findFirst({ where: eq(schema.tenants.slug, slug) });
  if (!tenant) throw new Error(`tenant ${slug} not found`);
  await mkdir(out, { recursive: true });
  const itineraryId = flag("itinerary")?.[0] ?? null;
  const base = await printBaseUrl({ tenantId: tenant.id, itineraryId, preview: !itineraryId });

  const report = [];
  // Warm Chromium and the dev server's route compile so timings are warm.
  await renderPdf(`${base}&days=2`, tenant.id, "minimal").catch(() => undefined);
  for (const style of styles)
    for (const days of dayCounts)
      for (const p of pricing) {
        const started = Date.now();
        // A real itinerary (--itinerary) ignores days/pricing; the fixture uses them.
        const title = flag("title")?.join(",");
        const url = itineraryId
          ? base
          : `${base}&days=${days}&priced=${p === "priced" ? 1 : 0}${title ? `&title=${encodeURIComponent(title)}` : ""}`;
        const r = await renderPdf(url, tenant.id, style);
        const ms = Date.now() - started;
        const file = join(out, `${style}-${days}d-${p}.pdf`);
        await writeFile(file, r.pdf);
        const doc = await PDFDocument.load(r.pdf);
        report.push({
          style,
          days,
          pricing: p,
          pages: doc.getPageCount(),
          parts: r.parts ?? null,
          mb: Math.round((r.pdf.length / 1024 / 1024) * 100) / 100,
          ms,
          file,
        });
        console.error(`${style} ${days}d ${p}: ${doc.getPageCount()} pages, ${ms} ms`);
      }
  console.log(JSON.stringify(report, null, 2));
  await closePdfBrowser();
  await closeDb();
}

main().catch(async (err) => {
  console.error(err);
  await closePdfBrowser();
  process.exit(1);
});
