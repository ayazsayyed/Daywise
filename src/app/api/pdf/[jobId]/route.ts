import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { pdfFilename } from "@/features/share/url";
import { getSession } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * One-time PDF download for the agent who asked for it (tenant from the
 * session). The bytes are deleted as they are handed over: the PDF is never
 * kept (Day 4 brief 4).
 */
export async function GET(_req: Request, ctx: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await ctx.params;
  if (!z.string().uuid().safeParse(jobId).success)
    return new NextResponse("Not found", { status: 404 });
  const session = await getSession();
  if (!session?.tenant || session.tenant.status === "suspended")
    return new NextResponse("Sign in", { status: 401 });

  const [row] = await db
    .delete(schema.pdfJobs)
    .where(
      and(
        eq(schema.pdfJobs.id, jobId),
        eq(schema.pdfJobs.tenantId, session.tenant.id),
        eq(schema.pdfJobs.status, "done"),
      ),
    )
    .returning({ pdf: schema.pdfJobs.pdf, itineraryId: schema.pdfJobs.itineraryId });
  if (!row?.pdf)
    return new NextResponse("This PDF has expired. Please prepare it again.", { status: 410 });

  const it = await db.query.itineraries.findFirst({
    columns: { title: true },
    where: and(
      eq(schema.itineraries.id, row.itineraryId),
      eq(schema.itineraries.tenantId, session.tenant.id),
    ),
  });
  const name = pdfFilename(it?.title ?? "itinerary");
  return new NextResponse(new Uint8Array(row.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(row.pdf.length),
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
