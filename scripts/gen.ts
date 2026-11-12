import "./load-env";
import { eq } from "drizzle-orm";

import { closeDb, db, schema } from "@/lib/db";
import { tenantScope } from "@/lib/db/tenant";
import { formatDate } from "@/lib/format";
import { imageCredit } from "@/lib/images/resolve";
import { runPipeline } from "@/lib/itinerary/pipeline";

/**
 * `pnpm gen "5-day Kashmir couple mid-range" [--tenant sktw] [--save] [--json]`
 * Runs the pipeline in-process (no pg-boss) and prints a readable summary with
 * verification %. `--save` persists it as a draft for the tenant.
 */
function parseArgs(argv: string[]) {
  const args = { prompt: "", tenant: "sktw", save: false, json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--tenant") args.tenant = argv[++i] ?? args.tenant;
    else if (a === "--save") args.save = true;
    else if (a === "--json") args.json = true;
    else if (!a.startsWith("--")) args.prompt = args.prompt ? `${args.prompt} ${a}` : a;
  }
  return args;
}

function pct(n: number, total: number): string {
  return total === 0 ? "n/a" : `${Math.round((n / total) * 100)}%`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.prompt) {
    console.error('usage: pnpm gen "<prompt>" [--tenant sktw] [--save] [--json]');
    process.exit(2);
  }

  const tenant = await db.query.tenants.findFirst({ where: eq(schema.tenants.slug, args.tenant) });
  if (!tenant) throw new Error(`tenant ${args.tenant} not found (run pnpm db:seed)`);

  const started = Date.now();
  const out = await runPipeline({
    tenantId: tenant.id,
    prompt: args.prompt,
    themeColor: tenant.branding.theme_color,
    onProgress: (p) => {
      if (!args.json && p.result)
        console.error(`  ✓ ${p.step.padEnd(10)} ${p.result} (${p.ms} ms)`);
      else if (!args.json) console.error(`  … ${p.step}`);
    },
  });
  const elapsed = Date.now() - started;
  const { brief, itinerary, usage } = out;
  const s = itinerary.stats;

  let savedId: string | null = null;
  if (args.save) {
    const row = await tenantScope(tenant.id).createGeneratedItinerary({
      brief,
      itinerary,
      prompt: args.prompt,
      defaults: tenant.defaults,
    });
    savedId = row.id;
  }

  if (args.json) {
    console.log(
      JSON.stringify({ brief, itinerary, usage, timings: out.timings, elapsed, savedId }, null, 2),
    );
    return;
  }

  console.log("");
  console.log(`${itinerary.title}`);
  console.log(itinerary.summary);
  console.log("");
  console.log(
    `Brief: ${brief.destination} (${brief.country}) · ${brief.cities.join(" → ")} · ${brief.nights} nights` +
      ` · ${brief.pax.adults}A${brief.pax.children ? `+${brief.pax.children}C` : ""} · ${brief.budget} · ${brief.pace}` +
      (brief.start_date ? ` · from ${formatDate(brief.start_date)}` : ""),
  );
  if (brief.assumed.length) console.log(`Assumed: ${brief.assumed.join(", ")}`);
  console.log("");

  for (const d of itinerary.days) {
    console.log(
      `Day ${d.day_number}${d.date ? ` · ${formatDate(d.date)}` : ""} — ${d.title} (${d.city})`,
    );
    console.log(`  ${d.summary}`);
    console.log(`  Transport: ${d.transport}`);
    console.log(
      `  Hero: ${d.hero_image.source}${imageCredit(d.hero_image) ? ` · ${imageCredit(d.hero_image)}` : ""}`,
    );
    for (const st of d.stops) {
      const mark = st.place_query ? (st.verified ? "✓" : "✗") : "·";
      console.log(
        `  ${mark} ${st.time ?? "     "} ${st.title}${st.duration ? ` (${st.duration})` : ""} [${st.kind}]`,
      );
    }
    if (d.hotel) {
      console.log(
        `  Hotel: ${d.hotel.name} · ${d.hotel.room_type} · ${d.hotel.meal_plan} · ${d.hotel.verified ? "Verified" : "Verify before sending"}` +
          (d.hotel.address ? ` · ${d.hotel.address}` : ""),
      );
    }
    console.log("");
  }
  if (itinerary.notes.length) console.log(`Notes: ${itinerary.notes.join(" | ")}`);
  console.log("");
  console.log(
    `Verification: hotels ${s.hotels}/${s.hotels_total} (${pct(s.hotels, s.hotels_total)}) · stops ${s.stops}/${s.stops_total} (${pct(s.stops, s.stops_total)})` +
      ` · Places calls ${s.places_calls}${s.budget_exhausted ? " · BUDGET EXHAUSTED" : ""}${s.places_failed ? ` · PLACES FAILED ${s.places_failed}× (key/network; see log)` : ""}`,
  );
  const tokens = usage.reduce((a, u) => a + u.tokensIn + u.tokensOut, 0);
  const providers = [...new Set(usage.filter((u) => u.ok).map((u) => `${u.provider}/${u.model}`))];
  console.log(
    `AI: ${usage.length} calls · ${tokens} tokens · ${providers.join(", ") || "mock"} · enhance ${out.timings.enhancing} ms · draft ${out.timings.drafting} ms · verify ${out.timings.verifying} ms`,
  );
  console.log(
    `Total ${(elapsed / 1000).toFixed(1)} s${savedId ? ` · saved as itinerary ${savedId}` : ""}`,
  );
}

main()
  .then(() => closeDb())
  .catch(async (err) => {
    console.error(err instanceof Error ? `${err.name}: ${err.message}` : err);
    await closeDb();
    process.exit(1);
  });
