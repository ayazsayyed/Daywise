import "./load-env";
import { and, eq } from "drizzle-orm";

import { closeDb, db, schema } from "@/lib/db";

import { parseClearArgs } from "@/lib/cli/learnings-clear-args";

/**
 * Local reset for polluted agency learnings (#14).
 *   pnpm learnings:clear --tenant sktw [--destination Kashmir]
 */
async function main() {
  const args = parseClearArgs(process.argv.slice(2));
  const tenant = await db.query.tenants.findFirst({
    where: eq(schema.tenants.slug, args.tenant),
  });
  if (!tenant) throw new Error(`No tenant with slug "${args.tenant}"`);

  const rows = await db
    .delete(schema.tenantLearnings)
    .where(
      and(
        eq(schema.tenantLearnings.tenantId, tenant.id),
        args.destination ? eq(schema.tenantLearnings.destination, args.destination) : undefined,
      ),
    )
    .returning({ id: schema.tenantLearnings.id });
  console.log(
    `Deleted ${rows.length} learning(s) for ${args.tenant}${args.destination ? ` / ${args.destination}` : ""}`,
  );
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(closeDb);
