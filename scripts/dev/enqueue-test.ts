import "../load-env";
import { eq } from "drizzle-orm";

import { closeDb, db, schema } from "@/lib/db";
import { getBoss, QUEUES } from "@/lib/jobs/boss";

/**
 * Dev helper: enqueues one generation job for a tenant slug and waits for the
 * worker (`pnpm worker`) to finish it, printing the progress rows as they
 * change. Usage: pnpm exec tsx scripts/dev/enqueue-test.ts "<prompt>" [slug]
 */
async function main() {
  const prompt = process.argv[2] ?? "5-day Kashmir for a couple, mid-range";
  const slug = process.argv[3] ?? "sktw";
  const tenant = await db.query.tenants.findFirst({ where: eq(schema.tenants.slug, slug) });
  if (!tenant) throw new Error(`tenant ${slug} not found`);

  const [job] = await db
    .insert(schema.generationJobs)
    .values({ tenantId: tenant.id, prompt, status: "queued" })
    .returning();
  const boss = await getBoss();
  await boss.send(QUEUES.generate, { jobId: job!.id, tenantId: tenant.id }, { retryLimit: 1 });
  console.log(`queued job ${job!.id}`);

  const started = Date.now();
  let last = "";
  while (Date.now() - started < 120_000) {
    const row = await db.query.generationJobs.findFirst({
      where: eq(schema.generationJobs.id, job!.id),
    });
    const line = `${row?.status} ${JSON.stringify(row?.progress.steps.map((s) => s.result))}`;
    if (line !== last) {
      console.log(`${((Date.now() - started) / 1000).toFixed(1)}s ${line}`);
      last = line;
    }
    if (row?.status === "done" || row?.status === "failed") {
      console.log(row.status === "done" ? `itinerary ${row.itineraryId}` : `error: ${row.error}`);
      break;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  await boss.stop({ graceful: false });
  await closeDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
