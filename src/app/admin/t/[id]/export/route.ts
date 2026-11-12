import { NextResponse } from "next/server";
import { z } from "zod";

import { buildTenantExport } from "@/features/admin/export";
import { auditEvent } from "@/lib/audit";
import { requireSuperadmin } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

/** Superadmin: download any tenant's data as a zip of JSON files. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireSuperadmin();
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success)
    return new NextResponse("not found", { status: 404 });
  const out = await buildTenantExport(id);
  if (!out) return new NextResponse("not found", { status: 404 });
  await auditEvent("admin.tenant.export", {
    tenantId: id,
    userId: session.user.id,
    entity: "tenant",
    entityId: id,
    meta: { bytes: out.zip.length, ...out.counts },
  });
  return zipResponse(out.filename, out.zip);
}

function zipResponse(filename: string, zip: Buffer) {
  return new NextResponse(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(zip.length),
      "Cache-Control": "private, no-store",
    },
  });
}
