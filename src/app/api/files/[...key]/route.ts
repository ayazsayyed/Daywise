import { NextResponse, type NextRequest } from "next/server";

import { getObject } from "@/lib/storage/r2";

export const dynamic = "force-dynamic";

/** Read-only proxy for tenant logos (and later cached destination images) stored in R2. */
const ALLOWED_PREFIXES = ["tenants/", "images/"];

export async function GET(_req: NextRequest, ctx: { params: Promise<{ key: string[] }> }) {
  const { key: parts } = await ctx.params;
  const key = parts.map(decodeURIComponent).join("/");
  if (!ALLOWED_PREFIXES.some((p) => key.startsWith(p)) || key.includes("..")) {
    return new NextResponse("Not found", { status: 404 });
  }

  const obj = await getObject(key);
  if (!obj) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(Buffer.from(obj.body), {
    headers: {
      "Content-Type": obj.contentType,
      "Cache-Control": "public, max-age=2592000, immutable",
      "X-Content-Type-Options": "nosniff",
      // SVG logos: never let an uploaded file run scripts if opened directly.
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src data:",
    },
  });
}
