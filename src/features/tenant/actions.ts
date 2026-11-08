"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireTenant } from "@/lib/auth/guards";
import { tenantBrandingSchema, tenantDefaultsSchema } from "@/lib/db/json";
import { tenantScope } from "@/lib/db/tenant";
import { logger } from "@/lib/logger";
import { publicUrlFor, putObject, r2Configured } from "@/lib/storage/r2";

export type SaveState =
  | { status: "idle" }
  | { status: "saved"; at: string }
  | { status: "error"; message: string; field?: string };

const settingsFormSchema = z.object({
  theme_color: z.string().trim(),
  phone: z.string().trim(),
  whatsapp: z.string().trim(),
  email: z.string().trim(),
  address: z.string().trim(),
  footer: z.string().trim(),
  inclusions: z.string(),
  exclusions: z.string(),
  payment_terms: z.string(),
  cancellation: z.string(),
});

export async function saveSettings(_prev: SaveState, formData: FormData): Promise<SaveState> {
  const session = await requireTenant();
  const scope = tenantScope(session.tenant.id);

  const raw = settingsFormSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!raw.success) return { status: "error", message: "Please check the form and try again." };
  const f = raw.data;

  const branding = tenantBrandingSchema.safeParse({
    logo_url: session.tenant.branding.logo_url,
    theme_color: f.theme_color.toUpperCase(),
    phone: f.phone,
    whatsapp: f.whatsapp,
    email: f.email,
    address: f.address,
    footer: f.footer,
  });
  if (!branding.success) {
    const issue = branding.error.issues[0];
    return {
      status: "error",
      message: issue?.message ?? "Invalid branding",
      field: String(issue?.path[0] ?? ""),
    };
  }
  const defaults = tenantDefaultsSchema.safeParse({
    inclusions: f.inclusions,
    exclusions: f.exclusions,
    payment_terms: f.payment_terms,
    cancellation: f.cancellation,
  });
  if (!defaults.success) {
    const issue = defaults.error.issues[0];
    return {
      status: "error",
      message: issue?.message ?? "Invalid defaults",
      field: String(issue?.path[0] ?? ""),
    };
  }

  try {
    await scope.updateBranding(branding.data);
    await scope.updateDefaults(defaults.data);
    await scope.audit("tenant.settings.update", {
      userId: session.user.id,
      entity: "tenant",
      entityId: session.tenant.id,
    });
  } catch (err) {
    logger.error({ err }, "saveSettings failed");
    return { status: "error", message: "Could not save settings. Please try again." };
  }

  revalidatePath("/app/settings");
  revalidatePath("/app");
  return { status: "saved", at: new Date().toISOString() };
}

const MAX_LOGO_BYTES = 1024 * 1024; // 1 MB
const LOGO_TYPES: Record<string, string> = { "image/png": "png", "image/svg+xml": "svg" };

export type UploadState =
  { status: "idle" } | { status: "uploaded"; url: string } | { status: "error"; message: string };

export async function uploadLogo(_prev: UploadState, formData: FormData): Promise<UploadState> {
  const session = await requireTenant();
  const scope = tenantScope(session.tenant.id);

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0)
    return { status: "error", message: "Choose a PNG or SVG file." };
  if (file.size > MAX_LOGO_BYTES)
    return { status: "error", message: "Logo must be 1 MB or smaller." };

  const ext = LOGO_TYPES[file.type];
  if (!ext) return { status: "error", message: "Only PNG or SVG logos are accepted." };

  const bytes = Buffer.from(await file.arrayBuffer());
  // Sniff the real content, not just the declared type.
  const isPng = bytes
    .subarray(0, 8)
    .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const head = bytes.subarray(0, 512).toString("utf8").trimStart().toLowerCase();
  const isSvg = head.startsWith("<svg") || (head.startsWith("<?xml") && head.includes("<svg"));
  if ((ext === "png" && !isPng) || (ext === "svg" && !isSvg)) {
    return { status: "error", message: "That file doesn't look like a valid PNG or SVG." };
  }
  if (ext === "svg" && /<script|on\w+\s*=|javascript:/i.test(bytes.toString("utf8"))) {
    return { status: "error", message: "SVG logos must not contain scripts or event handlers." };
  }

  if (!r2Configured())
    return { status: "error", message: "File storage (R2) is not configured on this server." };

  try {
    const key = `tenants/${session.tenant.id}/logo-${Date.now()}.${ext}`;
    await putObject(key, bytes, file.type);
    const url = publicUrlFor(key);
    await scope.updateBranding({ ...session.tenant.branding, logo_url: url });
    await scope.audit("tenant.logo.upload", {
      userId: session.user.id,
      entity: "tenant",
      entityId: session.tenant.id,
      meta: { key },
    });
    revalidatePath("/app/settings");
    revalidatePath("/app");
    return { status: "uploaded", url };
  } catch (err) {
    logger.error({ err }, "uploadLogo failed");
    return { status: "error", message: "Upload failed. Please try again." };
  }
}

export async function removeLogo(): Promise<void> {
  const session = await requireTenant();
  const scope = tenantScope(session.tenant.id);
  await scope.updateBranding({ ...session.tenant.branding, logo_url: null });
  await scope.audit("tenant.logo.remove", {
    userId: session.user.id,
    entity: "tenant",
    entityId: session.tenant.id,
  });
  revalidatePath("/app/settings");
  revalidatePath("/app");
}
