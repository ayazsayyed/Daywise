import "./load-env";
import { eq, sql } from "drizzle-orm";

import { closeDb, db, schema } from "@/lib/db";
import { DEFAULT_BRANDING, DEFAULT_DEFAULTS } from "@/lib/db/json";

/**
 * Seeds tenant #1 (Shree Krishna Travel World) and the superadmin/admin user.
 * Idempotent: re-running updates nothing destructive and never overwrites
 * branding the agency has already saved.
 *
 * Brand pack (docs/reference/sktw/) was not present when this was written, so
 * contact details are placeholders to be replaced in /app/settings.
 */
async function main() {
  const email = (process.env.SUPERADMIN_EMAIL ?? "").trim().toLowerCase();
  if (!email) throw new Error("SUPERADMIN_EMAIL is not set");

  const existing = await db.query.tenants.findFirst({ where: eq(schema.tenants.slug, "sktw") });

  let tenantId: string;
  if (existing) {
    tenantId = existing.id;
    console.log(`tenant sktw exists (${tenantId}) — leaving branding untouched`);
  } else {
    const [created] = await db
      .insert(schema.tenants)
      .values({
        slug: "sktw",
        name: "Shree Krishna Travel World",
        customDomain: "itinerary.shreekrishnatravelworld.com",
        plan: "standard",
        dailyGenCap: 50,
        branding: {
          ...DEFAULT_BRANDING,
          theme_color: "#1E6FB8",
          footer: "Shree Krishna Travel World · Itinerary subject to weather and local conditions.",
        },
        defaults: {
          ...DEFAULT_DEFAULTS,
          inclusions:
            "Accommodation as per itinerary\nDaily breakfast\nAll transfers and sightseeing by private vehicle\nDriver allowance, tolls and parking",
          exclusions:
            "Airfare / train tickets\nMonument entry fees unless specified\nMeals not mentioned\nPersonal expenses, tips and anything not listed under inclusions",
          payment_terms: "50% advance to confirm the booking; balance 7 days before travel.",
          cancellation:
            "30+ days before travel: 25% of package cost\n15–29 days: 50%\nUnder 15 days: 100%",
        },
      })
      .returning();
    tenantId = created!.id;
    console.log(`created tenant sktw (${tenantId})`);
  }

  const user = await db.query.users.findFirst({
    where: sql`lower(${schema.users.email}) = ${email}`,
  });
  if (user) {
    if (user.tenantId !== tenantId || user.role !== "superadmin") {
      await db
        .update(schema.users)
        .set({ tenantId, role: "superadmin", updatedAt: new Date() })
        .where(eq(schema.users.id, user.id));
      console.log(`attached ${email} to sktw as superadmin`);
    } else {
      console.log(`${email} already attached to sktw`);
    }
  } else {
    await db.insert(schema.users).values({ email, role: "superadmin", tenantId });
    console.log(`created ${email} as superadmin on sktw`);
  }
}

main()
  .then(async () => {
    await closeDb();
  })
  .catch(async (err) => {
    console.error(err);
    await closeDb();
    process.exit(1);
  });
