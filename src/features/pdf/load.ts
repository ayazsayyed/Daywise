import "server-only";

import { eq } from "drizzle-orm";

import { toEditorDoc } from "@/features/editor/load";
import { agencyOf, printPhotos } from "@/features/share/load";
import { buildShareView, shareImage, type ShareImage } from "@/features/share/view";
import { db, schema } from "@/lib/db";
import { DEFAULT_BRANDING, tenantBrandingSchema } from "@/lib/db/json";
import { resolveShare, type ShareTenant } from "@/lib/db/share";
import { env } from "@/lib/env";
import { destinationImage, imageCredit, imageUrl } from "@/lib/images/resolve";
import type { EditorDoc } from "@/lib/itinerary/doc";
import { logger } from "@/lib/logger";
import { publicUrlFor } from "@/lib/storage/r2";

import { TITLE_FONTS, type TitleFont } from "./constants";
import { pickCoverPhotos } from "./cover-photos";
import { SAMPLE_EYEBROW, SAMPLE_SUMMARY, sampleDoc } from "./sample";
import { resolveStyle, type PdfStyle } from "./styles";
import { buildTokens, type PdfTokens } from "./tokens";
import { buildPdfView, type PdfView } from "./view";

export type PdfLoad = { view: PdfView; tokens: PdfTokens; style: PdfStyle; tenant: ShareTenant };

function brandingOf(tenant: ShareTenant) {
  const parsed = tenantBrandingSchema.safeParse(tenant.branding);
  return parsed.success ? parsed.data : { ...DEFAULT_BRANDING, ...tenant.branding };
}

/** R2 objects for print: same-origin path when there is no public bucket URL (the worker loads the app internally). */
function printUrlFor(key: string): string {
  return env.R2_PUBLIC_URL
    ? publicUrlFor(key)
    : `/api/files/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export const asTitleFont = (v: string | null | undefined): TitleFont =>
  (TITLE_FONTS as readonly string[]).includes(v ?? "") ? (v as TitleFont) : "inter";

export function tenantTokens(tenant: ShareTenant, style: PdfStyle): PdfTokens {
  const b = brandingOf(tenant);
  const backdrop =
    style.supportsBackdrop && tenant.coverBackdropKey ? tenant.coverBackdropKey : null;
  return buildTokens({
    primary: b.theme_color,
    accent: tenant.accentColor,
    titleFont: asTitleFont(tenant.titleFont),
    backdropUrl: backdrop ? printUrlFor(backdrop) : null,
    backdropText: tenant.coverBackdropMeta?.text ?? null,
  });
}

/** Too few itinerary photos for the cover → destination photos (Pexels/Wikimedia, cached). */
async function fallbackPhotos(doc: EditorDoc): Promise<ShareImage[]> {
  if (pickCoverPhotos(doc).length >= 2) return [];
  const queries = [
    ...new Set([doc.destination, ...doc.days.map((d) => d.city)].filter(Boolean)),
  ].slice(0, 3);
  const out: ShareImage[] = [];
  for (const q of queries) {
    try {
      const ref = await destinationImage(q);
      if (!ref) continue;
      const img = shareImage({ ...ref, url: imageUrl(ref, 1200), credit: imageCredit(ref) }, q);
      if (img && !out.some((o) => o.url === img.url)) out.push(img);
    } catch (err) {
      logger.warn({ err, q }, "cover fallback photo failed");
    }
    if (out.length >= 2) break;
  }
  return out;
}

/** A shared itinerary for print (token → link → itinerary → tenant, as the share page). */
export async function loadPdfByToken(token: string): Promise<PdfLoad | null> {
  const res = await resolveShare(token, undefined, { allowDisabledLink: true });
  if (res.kind !== "ok") return null;
  const { tree, tenant } = res;
  const doc = printPhotos(toEditorDoc(tree));
  const raw = (tree.brief ?? {}) as Record<string, unknown>;
  const share = buildShareView({
    doc,
    agencyName: tenant.name,
    branding: brandingOf(tenant),
    summary: typeof raw.summary === "string" ? raw.summary : "",
    updatedAt: tree.updatedAt,
  });
  const style = resolveStyle(tenant.pdfStyle, tenant.id);
  const view = buildPdfView({
    share,
    doc,
    cover: tree.cover ?? null,
    fallbackPhotos: await fallbackPhotos(doc),
  });
  return { view, tokens: tenantTokens(tenant, style), style, tenant };
}

/** Settings "Preview PDF" and golden renders: the sample Kashmir fixture with the tenant's saved style. */
export async function loadPdfPreview(
  tenantId: string,
  opts: { days?: number; priced?: boolean; styleId?: string; title?: string } = {},
): Promise<PdfLoad | null> {
  const tenant = await db.query.tenants.findFirst({ where: eq(schema.tenants.id, tenantId) });
  if (!tenant) return null;
  const doc = sampleDoc({ days: opts.days ?? 5, priced: opts.priced ?? true, title: opts.title });
  const share = buildShareView({
    doc,
    agencyName: tenant.name,
    branding: brandingOf(tenant),
    summary: SAMPLE_SUMMARY,
    updatedAt: new Date(),
  });
  const style = resolveStyle(opts.styleId ?? tenant.pdfStyle, tenant.id);
  const view = buildPdfView({ share, doc, cover: { eyebrow: SAMPLE_EYEBROW, photos: null } });
  return { view, tokens: tenantTokens(tenant, style), style, tenant };
}

export { agencyOf };
