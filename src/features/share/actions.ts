"use server";

import { and, count, eq, gte } from "drizzle-orm";
import { z } from "zod";

import { requireTenant } from "@/lib/auth/guards";
import { db, schema } from "@/lib/db";
import { InvalidEditError, NotFoundError } from "@/lib/db/itinerary";
import { mintShareToken } from "@/lib/db/share";
import { tenantScope } from "@/lib/db/tenant";
import { env } from "@/lib/env";
import { startOfMonthIST } from "@/lib/format";
import { getBoss, QUEUES } from "@/lib/jobs/boss";
import { logger } from "@/lib/logger";

import { shareUrl } from "./url";
import { agentShareMessage, waHref } from "./whatsapp";

/**
 * Share panel (PNG 14). Every action takes the tenant from the session and
 * checks the itinerary belongs to it (tenantScope). Nothing here trusts a
 * tenant id from the client.
 */
const uuid = z.string().uuid();

export type ShareState = {
  url: string;
  enabled: boolean;
  viewCount: number;
  lastViewedAt: string | null;
  lastViewedDevice: string | null;
  createdAt: string;
};

type Result<T> = { ok: true; data: T } | { ok: false; message: string };

async function scoped(itineraryId: string) {
  if (!uuid.safeParse(itineraryId).success) throw new NotFoundError();
  const session = await requireTenant();
  return { session, scope: tenantScope(session.tenant.id) };
}

function fail(err: unknown, what: string): { ok: false; message: string } {
  if (err instanceof NotFoundError) return { ok: false, message: "Itinerary not found" };
  if (err instanceof InvalidEditError) return { ok: false, message: err.message };
  logger.error({ err }, what);
  return { ok: false, message: "Something went wrong. Please try again." };
}

function toState(
  link: typeof schema.shareLinks.$inferSelect,
  tenant: { slug: string; customDomain: string | null },
): ShareState {
  return {
    url: shareUrl(tenant, link.token, env.APP_URL),
    enabled: link.enabled,
    viewCount: link.viewCount,
    lastViewedAt: link.lastViewedAt?.toISOString() ?? null,
    lastViewedDevice: link.lastViewedDevice,
    createdAt: link.createdAt.toISOString(),
  };
}

/** Opening the panel: returns the link, creating it (on) the first time (PNG 14). */
export async function openShare(itineraryId: string): Promise<Result<ShareState>> {
  try {
    const { session, scope } = await scoped(itineraryId);
    const link = await scope.ensureShareLink(itineraryId, mintShareToken);
    return { ok: true, data: toState(link, session.tenant) };
  } catch (err) {
    return fail(err, "openShare failed");
  }
}

export async function setLinkEnabled(
  itineraryId: string,
  enabled: boolean,
): Promise<Result<ShareState>> {
  try {
    const { session, scope } = await scoped(itineraryId);
    const link = await scope.setShareEnabled(itineraryId, !!enabled, mintShareToken);
    await scope.audit(enabled ? "share.enable" : "share.disable", {
      entity: "itinerary",
      entityId: itineraryId,
    });
    return { ok: true, data: toState(link, session.tenant) };
  } catch (err) {
    return fail(err, "setLinkEnabled failed");
  }
}

/** Copy link / WhatsApp / PDF count as sharing: a draft becomes Sent. */
export async function markShared(
  itineraryId: string,
): Promise<Result<{ status: "draft" | "sent" | "confirmed" | "lost" }>> {
  try {
    const { scope } = await scoped(itineraryId);
    const status = await scope.markShared(itineraryId);
    return { ok: true, data: { status } };
  } catch (err) {
    return fail(err, "markShared failed");
  }
}

export type PdfJobState = {
  id: string;
  status: "queued" | "rendering" | "done" | "failed";
  pages: number | null;
  bytes: number | null;
  error: string | null;
};

/** Download PDF: queue a render; the panel polls `getPdfJob` and then downloads. */
export async function requestPdf(itineraryId: string): Promise<Result<PdfJobState>> {
  try {
    const { session, scope } = await scoped(itineraryId);
    const it = await scope.getItineraryTree(itineraryId);
    if (it.isTemplate) return { ok: false, message: "Templates cannot be shared." };
    const tenant = await scope.getTenant();
    const [used] = await db
      .select({ n: count() })
      .from(schema.usageEvents)
      .where(
        and(
          eq(schema.usageEvents.tenantId, session.tenant.id),
          eq(schema.usageEvents.kind, "pdf"),
          gte(schema.usageEvents.createdAt, startOfMonthIST()),
        ),
      );
    if ((used?.n ?? 0) >= tenant.monthlyPdfCap)
      return {
        ok: false,
        message: `This month's PDF limit (${tenant.monthlyPdfCap}) is used up. Share the link instead.`,
      };
    await scope.ensureShareLink(itineraryId, mintShareToken);
    const [job] = await db
      .insert(schema.pdfJobs)
      .values({ tenantId: session.tenant.id, itineraryId: it.id })
      .returning();
    const boss = await getBoss();
    await boss.send(
      QUEUES.pdf,
      { jobId: job!.id, tenantId: session.tenant.id },
      { retryLimit: 0, expireInSeconds: 120 },
    );
    return {
      ok: true,
      data: { id: job!.id, status: "queued", pages: null, bytes: null, error: null },
    };
  } catch (err) {
    return fail(err, "requestPdf failed");
  }
}

export async function getPdfJob(jobId: string): Promise<Result<PdfJobState>> {
  if (!uuid.safeParse(jobId).success) return { ok: false, message: "Not found" };
  const session = await requireTenant();
  const job = await db.query.pdfJobs.findFirst({
    columns: { id: true, status: true, pages: true, bytes: true, error: true },
    where: and(eq(schema.pdfJobs.id, jobId), eq(schema.pdfJobs.tenantId, session.tenant.id)),
  });
  if (!job) return { ok: false, message: "This PDF has expired. Please prepare it again." };
  return { ok: true, data: job as PdfJobState };
}

/** Dashboard quick actions: link (created if needed) + the prefilled WhatsApp href. */
export async function quickShare(
  itineraryId: string,
): Promise<Result<{ url: string; enabled: boolean; whatsapp: string }>> {
  try {
    const { session, scope } = await scoped(itineraryId);
    const link = await scope.ensureShareLink(itineraryId, mintShareToken);
    const tree = await scope.getItineraryTree(itineraryId);
    const url = shareUrl(session.tenant, link.token, env.APP_URL);
    const destination = String((tree.brief as { destination?: string } | null)?.destination ?? "");
    const text = agentShareMessage({
      clientName: tree.client?.name,
      destination,
      agency: session.tenant.name,
      link: url,
    });
    return {
      ok: true,
      data: { url, enabled: link.enabled, whatsapp: waHref(tree.client?.phone, text) },
    };
  } catch (err) {
    return fail(err, "quickShare failed");
  }
}
