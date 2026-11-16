import "../load-env";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { eq } from "drizzle-orm";
import sharp from "sharp";

import { analyseBackdrop } from "@/features/pdf/backdrop";
import { checkBackdropDimensions } from "@/features/pdf/geometry";
import { closeDb, db, schema } from "@/lib/db";
import { DEFAULT_BRANDING, tenantBrandingSchema } from "@/lib/db/json";
import { tenantScope } from "@/lib/db/tenant";
import { putObject } from "@/lib/storage/r2";
import { sniffImage } from "@/lib/upload/sniff";

/**
 * Dev/verification helper (never production): set a tenant's PDF brand tokens
 * with the same checks as Settings.
 *   pnpm exec tsx scripts/dev/pdf-brand-set.ts <slug> [--style heritage] [--primary #0B4A5A]
 *     [--accent #C9A227] [--font serif] [--backdrop file.png|none] [--tagline "…"] [--website x.com]
 */
async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("not for production");
  const [slug, ...rest] = process.argv.slice(2);
  const opt = (k: string) => {
    const i = rest.indexOf(`--${k}`);
    return i >= 0 ? rest[i + 1] : undefined;
  };
  const tenant = await db.query.tenants.findFirst({ where: eq(schema.tenants.slug, slug!) });
  if (!tenant) throw new Error(`tenant ${slug} not found`);
  const scope = tenantScope(tenant.id);

  const parsed = tenantBrandingSchema.safeParse(tenant.branding);
  const branding = parsed.success ? parsed.data : { ...DEFAULT_BRANDING, ...tenant.branding };
  const patch: Record<string, string> = {};
  if (opt("primary")) patch.theme_color = opt("primary")!.toUpperCase();
  for (const k of [
    "tagline",
    "website",
    "phone",
    "whatsapp",
    "email",
    "address",
    "footer",
    "contact_person",
  ])
    if (opt(k) !== undefined) patch[k] = opt(k)!;
  if (Object.keys(patch).length) await scope.updateBranding({ ...branding, ...patch });

  await scope.updatePdfBrand({
    pdfStyle: opt("style") ?? tenant.pdfStyle,
    accentColor: opt("accent") ?? tenant.accentColor,
    titleFont: opt("font") ?? tenant.titleFont,
  });

  const file = opt("backdrop");
  if (file === "none") await scope.setCoverBackdrop(null, null);
  else if (file) {
    const bytes = await readFile(file);
    const kind = sniffImage(bytes);
    if (kind !== "png" && kind !== "jpg") throw new Error("not a PNG or JPG");
    const { width = 0, height = 0 } = await sharp(bytes).metadata();
    const check = checkBackdropDimensions(width, height);
    if (!check.ok) throw new Error(check.message);
    const a = await analyseBackdrop(bytes, width, height);
    const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
    const key = `tenants/${tenant.id}/pdf/backdrop-${hash}.${kind}`;
    await putObject(key, bytes, kind === "png" ? "image/png" : "image/jpeg");
    await scope.setCoverBackdrop(key, {
      w: width,
      h: height,
      bytes: bytes.length,
      text: a.text,
      contrast: a.contrast,
    });
    console.log(`backdrop: mean ${a.mean}, ${a.text} text, ${a.contrast}:1`);
  }
  const t = await scope.getTenant();
  console.log(
    JSON.stringify(
      {
        style: t.pdfStyle,
        primary: (t.branding as { theme_color: string }).theme_color,
        accent: t.accentColor,
        font: t.titleFont,
        backdrop: t.coverBackdropKey,
        meta: t.coverBackdropMeta,
      },
      null,
      2,
    ),
  );
  await closeDb();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
