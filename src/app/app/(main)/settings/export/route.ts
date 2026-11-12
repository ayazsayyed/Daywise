import { NextResponse } from "next/server";

import { buildTenantExport } from "@/features/admin/export";
import { requireTenant } from "@/lib/auth/guards";
import { tenantScope } from "@/lib/db/tenant";

export const dynamic = "force-dynamic";

/** The agency downloads its own data. Tenant from the session only. */
export async function GET() {
  const session = await requireTenant();
  const out = await buildTenantExport(session.tenant.id);
  if (!out) return new NextResponse("not found", { status: 404 });
  await tenantScope(session.tenant.id).audit("tenant.export", {
    userId: session.user.id,
    entity: "tenant",
    entityId: session.tenant.id,
    meta: { bytes: out.zip.length, ...out.counts },
  });
  return new NextResponse(new Uint8Array(out.zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${out.filename}"`,
      "Content-Length": String(out.zip.length),
      "Cache-Control": "private, no-store",
    },
  });
}
