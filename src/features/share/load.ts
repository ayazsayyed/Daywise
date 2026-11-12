import "server-only";

import { cache } from "react";

import { toEditorDoc } from "@/features/editor/load";
import { tenantBrandingSchema } from "@/lib/db/json";
import { resolveShare, shareTenantByToken, type ShareTenant } from "@/lib/db/share";
import { DEFAULT_BRANDING } from "@/lib/db/json";
import type { EditorDoc } from "@/lib/itinerary/doc";
import { logger } from "@/lib/logger";

import { printSizedUrl } from "./print-size";
import { buildAgency, buildShareView, type ShareAgency, type ShareView } from "./view";

export type ShareLoad =
  | { kind: "ok"; view: ShareView; linkId: string; tenantId: string; destination: string }
  | { kind: "disabled"; agency: ShareAgency }
  | { kind: "not_found" }
  | { kind: "unavailable"; agency: ShareAgency | null };

/**
 * Last good agency per token, so the unavailable page (PNG 28) still wears the
 * agency's header when the database is down. In-memory, per process, small.
 */
const lastAgency = new Map<string, ShareAgency>();
const LAST_AGENCY_MAX = 500;
function remember(token: string, agency: ShareAgency) {
  if (lastAgency.size >= LAST_AGENCY_MAX) lastAgency.delete(lastAgency.keys().next().value!);
  lastAgency.set(token, agency);
}

function agencyOf(tenant: ShareTenant, title = ""): ShareAgency {
  const parsed = tenantBrandingSchema.safeParse(tenant.branding);
  const branding = parsed.success ? parsed.data : { ...DEFAULT_BRANDING, ...tenant.branding };
  return buildAgency(tenant.name, branding, title);
}

/** Print: photos at the PDF re-encode targets (hero 1200 q72, hotel 800 q70). */
function printPhotos(doc: EditorDoc): EditorDoc {
  return {
    ...doc,
    days: doc.days.map((d) => ({
      ...d,
      hero: d.hero ? { ...d.hero, url: printSizedUrl(d.hero.url, 1200, 72) } : null,
      hotel: d.hotel
        ? {
            ...d.hotel,
            image: d.hotel.image
              ? { ...d.hotel.image, url: printSizedUrl(d.hotel.image.url, 800, 70) }
              : null,
          }
        : null,
    })),
  };
}

export const loadShare = cache(async function loadShare(
  token: string,
  print = false,
): Promise<ShareLoad> {
  try {
    const res = await resolveShare(token, undefined, { allowDisabledLink: print });
    if (res.kind === "not_found") return res;
    if (res.kind === "disabled") {
      const agency = agencyOf(res.tenant);
      remember(token, agency);
      return { kind: "disabled", agency };
    }
    const { tree, tenant, link } = res;
    const parsed = tenantBrandingSchema.safeParse(tenant.branding);
    const branding = parsed.success ? parsed.data : { ...DEFAULT_BRANDING, ...tenant.branding };
    let doc = toEditorDoc(tree);
    if (print) doc = printPhotos(doc);
    const raw = (tree.brief ?? {}) as Record<string, unknown>;
    const view = buildShareView({
      doc,
      agencyName: tenant.name,
      branding,
      summary: typeof raw.summary === "string" ? raw.summary : "",
      updatedAt: tree.updatedAt,
    });
    remember(token, view.agency);
    return { kind: "ok", view, linkId: link.id, tenantId: tenant.id, destination: doc.destination };
  } catch (err) {
    logger.error({ err }, "share page failed to load");
    let agency = lastAgency.get(token) ?? null;
    if (!agency) {
      const found = await shareTenantByToken(token).catch(() => null);
      if (found) agency = agencyOf(found.tenant);
    }
    return { kind: "unavailable", agency };
  }
});
