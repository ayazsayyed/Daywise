import { eq, or } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const HOSTNAME = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

/**
 * Caddy on-demand TLS `ask` endpoint. 200 = issue a certificate, 403 = refuse.
 * Approves only: the app host, <tenant-slug>.<app host>, and tenants' custom domains.
 */
export async function GET(req: NextRequest) {
  const domain = (req.nextUrl.searchParams.get("domain") ?? "").trim().toLowerCase();
  if (!HOSTNAME.test(domain)) return new NextResponse("invalid", { status: 403 });

  const appHost = new URL(env.APP_URL).hostname.toLowerCase();
  if (domain === appHost) return new NextResponse("ok");

  const sub = domain.endsWith(`.${appHost}`) ? domain.slice(0, -(appHost.length + 1)) : null;

  try {
    const tenant = await db.query.tenants.findFirst({
      columns: { id: true, status: true },
      where: or(
        eq(schema.tenants.customDomain, domain),
        ...(sub && !sub.includes(".") ? [eq(schema.tenants.slug, sub)] : []),
      ),
    });
    if (tenant) return new NextResponse("ok");
  } catch (err) {
    logger.error({ err, domain }, "tls-check lookup failed");
    return new NextResponse("error", { status: 503 });
  }

  logger.warn({ domain }, "tls-check refused unknown domain");
  return new NextResponse("unknown domain", { status: 403 });
}
