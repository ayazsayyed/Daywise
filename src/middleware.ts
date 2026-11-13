import { NextResponse, type NextRequest } from "next/server";

import { adminHostRedirect } from "@/lib/config/hosts";
import { env } from "@/lib/env";
import { ipFrom, limiter, RULES } from "@/lib/ratelimit";

const SESSION_COOKIE = "dw_session";

/**
 * Node-runtime middleware (one app process, so the in-memory limiter is shared
 * by every request):
 * - keeps sign-in and the admin on the APP_URL host; tenant hosts serve share
 *   pages only (#20);
 * - rate limits the public share page (60/min/IP) and the photo proxy;
 * - redirects anonymous requests away from /app/* and /admin/*. Full session
 *   validation (DB lookup, role, tenant status) happens in the server layouts
 *   via src/lib/auth/guards.ts.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const toApp = adminHostRedirect(req.headers.get("host"), pathname, req.nextUrl.search, env.APP_URL);
  if (toApp) return NextResponse.redirect(toApp, 308);

  if (pathname.startsWith("/s/") || pathname.startsWith("/api/photo/")) {
    const isPage = pathname.startsWith("/s/");
    // The worker's signed print render is internal; never throttle it.
    if (isPage && req.nextUrl.searchParams.has("sig")) return NextResponse.next();
    const ip = ipFrom(req.headers);
    const r = limiter.hit(
      `${isPage ? "page" : "photo"}:${ip}`,
      isPage ? RULES.sharePage : RULES.photo,
    );
    if (r.ok) return NextResponse.next();
    return isPage
      ? new NextResponse(TOO_MANY_HTML, {
          status: 429,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Retry-After": String(r.retryAfterSec),
            "X-Robots-Tag": "noindex",
            "Cache-Control": "no-store",
          },
        })
      : new NextResponse("Too many requests", {
          status: 429,
          headers: { "Retry-After": String(r.retryAfterSec) },
        });
  }

  if (!pathname.startsWith("/app") && !pathname.startsWith("/admin")) return NextResponse.next();

  if (!req.cookies.get(SESSION_COOKIE)?.value) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

// Calm, unbranded: the agency is unknown without a DB lookup, and this must stay cheap.
const TOO_MANY_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Please wait a moment</title></head>
<body style="margin:0;background:#F7F5F1;color:#1C1B19;font:15px/24px system-ui,sans-serif"><main style="max-width:560px;margin:0 auto;padding:96px 20px">
<h1 style="font-size:24px;line-height:30px;font-weight:600;margin:0 0 12px">Please wait a moment</h1>
<p style="color:#5E5B55;margin:0">This page was opened many times in a short while. Try again in a minute.</p></main></body></html>`;

export const config = {
  runtime: "nodejs",
  matcher: [
    "/",
    "/login",
    "/logout",
    "/auth/:path*",
    "/app/:path*",
    "/admin/:path*",
    "/s/:path*",
    "/api/photo/:path*",
  ],
};
