import { NextResponse, type NextRequest } from "next/server";

import { _resetAlertThrottle, alert } from "@/lib/alerts";
import { env } from "@/lib/env";
import { validOpsToken } from "@/lib/ops/token";

export const dynamic = "force-dynamic";

/**
 * Sends one Sentry test event from the app through `alert()` (the same path as
 * the Places budget alert). Called by the ops workflow from inside the app
 * container; the `x-ops-token` header is an HMAC of SESSION_SECRET.
 */
export async function POST(req: NextRequest) {
  if (!validOpsToken("sentry-test", req.headers.get("x-ops-token"), env.SESSION_SECRET))
    return new NextResponse("not found", { status: 404 });
  if (!env.SENTRY_DSN) return NextResponse.json({ ok: false, reason: "SENTRY_DSN not set" });
  _resetAlertThrottle();
  const eventId = await alert("warning", "ops_sentry_test", "Sentry test event from app (ops)", {
    at: new Date().toISOString(),
  });
  const Sentry = await import("@sentry/nextjs");
  await Sentry.flush(5000);
  return NextResponse.json({ ok: Boolean(eventId), service: "app", eventId });
}
