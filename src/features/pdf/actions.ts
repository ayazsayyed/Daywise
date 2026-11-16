"use server";

import { createHash } from "node:crypto";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import sharp from "sharp";

import type { PdfJobState } from "@/features/share/actions";
import { requireTenant } from "@/lib/auth/guards";
import { db, schema } from "@/lib/db";
import { tenantScope } from "@/lib/db/tenant";
import { getBoss, QUEUES } from "@/lib/jobs/boss";
import { logger } from "@/lib/logger";
import { deleteObject, putObject, storageReady } from "@/lib/storage/r2";
import { sniffImage } from "@/lib/upload/sniff";

import { BACKDROP_MAX_BYTES, BACKDROP_TYPES } from "./constants";
import { checkBackdropDimensions } from "./geometry";
import { analyseBackdrop } from "./backdrop";
import { MIN_BACKDROP_CONTRAST } from "./tokens";

export type BackdropState =
  | { status: "idle" }
  | { status: "uploaded"; text: "light" | "dark"; contrast: number; warning: string | null }
  | { status: "error"; message: string };

/** Optional cover backdrop: PNG/JPG, A4 portrait, ≥ 2480 × 3508 px, ≤ 8 MB, R2. */
export async function uploadBackdrop(
  _prev: BackdropState,
  formData: FormData,
): Promise<BackdropState> {
  const session = await requireTenant();
  const scope = tenantScope(session.tenant.id);
  const file = formData.get("backdrop");
  if (!(file instanceof File) || file.size === 0)
    return { status: "error", message: "Choose a PNG or JPG file." };
  if (file.size > BACKDROP_MAX_BYTES)
    return {
      status: "error",
      message: `This file is ${(file.size / 1048576).toFixed(1)} MB; the limit is 8 MB. Export as JPG.`,
    };
  if (!BACKDROP_TYPES[file.type as keyof typeof BACKDROP_TYPES])
    return { status: "error", message: "Only PNG or JPG images are accepted." };

  const bytes = Buffer.from(await file.arrayBuffer());
  const kind = sniffImage(bytes);
  if (kind !== "png" && kind !== "jpg")
    return { status: "error", message: "That file does not look like a valid PNG or JPG." };
  let w = 0;
  let h = 0;
  try {
    const meta = await sharp(bytes).metadata();
    w = meta.width ?? 0;
    h = meta.height ?? 0;
  } catch {
    return {
      status: "error",
      message: "That image could not be read. Export it again as PNG or JPG.",
    };
  }
  const dims = checkBackdropDimensions(w, h);
  if (!dims.ok) return { status: "error", message: dims.message };
  if (!storageReady())
    return { status: "error", message: "File storage (R2) is not configured on this server." };

  const tenant = await scope.getTenant();
  const previous = tenant.coverBackdropKey;
  const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
  const key = `tenants/${session.tenant.id}/pdf/backdrop-${hash}.${kind}`;
  try {
    const a = await analyseBackdrop(bytes, w, h);
    await putObject(key, bytes, kind === "png" ? "image/png" : "image/jpeg");
    await scope.setCoverBackdrop(key, {
      w,
      h,
      bytes: bytes.length,
      text: a.text,
      contrast: a.contrast,
    });
    if (previous && previous !== key) await deleteObject(previous).catch(() => undefined);
    await scope.audit("tenant.pdf.backdrop.upload", {
      userId: session.user.id,
      entity: "tenant",
      entityId: session.tenant.id,
      meta: { key, w, h, bytes: bytes.length, text: a.text, contrast: a.contrast },
    });
    revalidatePath("/app/settings");
    return {
      status: "uploaded",
      text: a.text,
      contrast: a.contrast,
      warning: a.contrast < MIN_BACKDROP_CONTRAST ? lowContrast(a.contrast) : null,
    };
  } catch (err) {
    logger.error({ err }, "uploadBackdrop failed");
    return { status: "error", message: "Upload failed. Please try again." };
  }
}

function lowContrast(contrast: number): string {
  return `Cover text will be hard to read on this image (${contrast.toFixed(1)}:1, needs 4.5:1). Use a darker or lighter image behind the title area.`;
}

export async function removeBackdrop(): Promise<void> {
  const session = await requireTenant();
  const scope = tenantScope(session.tenant.id);
  const tenant = await scope.getTenant();
  if (!tenant.coverBackdropKey) return;
  await scope.setCoverBackdrop(null, null);
  await deleteObject(tenant.coverBackdropKey).catch((err) =>
    logger.warn({ err }, "backdrop delete failed"),
  );
  await scope.audit("tenant.pdf.backdrop.remove", {
    userId: session.user.id,
    entity: "tenant",
    entityId: session.tenant.id,
  });
  revalidatePath("/app/settings");
}

/**
 * "Preview PDF": the sample Kashmir itinerary (fixture, not tenant data)
 * printed with the saved style through the normal worker job. Not counted
 * against the PDF cap; one preview in flight per tenant.
 */
export async function previewPdf(): Promise<
  { ok: true; data: PdfJobState } | { ok: false; message: string }
> {
  const session = await requireTenant();
  const busy = await db.query.pdfJobs.findFirst({
    columns: { id: true },
    where: and(
      eq(schema.pdfJobs.tenantId, session.tenant.id),
      eq(schema.pdfJobs.preview, true),
      inArray(schema.pdfJobs.status, ["queued", "rendering"]),
    ),
  });
  if (busy) return { ok: false, message: "A preview is already being prepared." };
  const [job] = await db
    .insert(schema.pdfJobs)
    .values({ tenantId: session.tenant.id, itineraryId: null, preview: true })
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
}
