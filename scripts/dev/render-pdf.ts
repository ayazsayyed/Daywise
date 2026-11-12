import "../load-env";

import { closeDb, db, schema } from "@/lib/db";
import { closePdfBrowser, handleRenderPdf } from "@/worker/jobs/render-pdf";
import { eq } from "drizzle-orm";
import { writeFileSync } from "node:fs";

/** Dev: render one itinerary's PDF without the queue. `pnpm tsx scripts/dev/render-pdf.ts <itineraryId> <out.pdf>` */
async function main() {
  const [itineraryId, out] = process.argv.slice(2);
  if (!itineraryId || !out) throw new Error("usage: render-pdf <itineraryId> <out.pdf>");
  const it = await db.query.itineraries.findFirst({
    where: eq(schema.itineraries.id, itineraryId),
  });
  if (!it) throw new Error("itinerary not found");
  const [job] = await db
    .insert(schema.pdfJobs)
    .values({ tenantId: it.tenantId, itineraryId })
    .returning();
  await handleRenderPdf({ jobId: job!.id, tenantId: it.tenantId });
  const done = await db.query.pdfJobs.findFirst({ where: eq(schema.pdfJobs.id, job!.id) });
  if (done?.pdf) writeFileSync(out, done.pdf);
  console.log(
    JSON.stringify({
      status: done?.status,
      pages: done?.pages,
      bytes: done?.bytes,
      ms: done?.ms,
      error: done?.error,
    }),
  );
  await db.delete(schema.pdfJobs).where(eq(schema.pdfJobs.id, job!.id));
}
main().finally(async () => {
  await closePdfBrowser();
  await closeDb();
});
