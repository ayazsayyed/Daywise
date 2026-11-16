import "../load-env";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { eq } from "drizzle-orm";

import { closeDb, db, schema } from "@/lib/db";
import { closePdfBrowser, printBaseUrl, renderPdf } from "@/worker/jobs/render-pdf";

/**
 * Editorial regression (dev only): prints each itinerary's share link as
 * Editorial from two app origins (e.g. main on :3102 and this branch on
 * :3101) and writes <out>/<id>-<label>.pdf for comparison.
 *   pnpm exec tsx scripts/dev/pdf-regress.ts <slug> <out> <label=origin>... -- <itineraryId>...
 */
async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("not for production");
  const [slug, out, ...rest] = process.argv.slice(2);
  const sep = rest.indexOf("--");
  const origins = rest.slice(0, sep).map((s) => s.split("=") as [string, string]);
  const ids = rest.slice(sep + 1);
  const tenant = await db.query.tenants.findFirst({ where: eq(schema.tenants.slug, slug!) });
  if (!tenant) throw new Error("tenant not found");
  for (const id of ids) {
    const base = await printBaseUrl({ tenantId: tenant.id, itineraryId: id, preview: false });
    const path = base.replace(/^https?:\/\/[^/]+/, "");
    for (const [label, origin] of origins) {
      const r = await renderPdf(`${origin}${path}`, tenant.id, "editorial");
      await writeFile(join(out!, `${id}-${label}.pdf`), r.pdf);
      console.log(`${id} ${label}: ${r.pages} pages, ${r.pdf.length} bytes`);
    }
  }
  await closePdfBrowser();
  await closeDb();
}
main().catch(async (e) => {
  console.error(e);
  await closePdfBrowser();
  process.exit(1);
});
