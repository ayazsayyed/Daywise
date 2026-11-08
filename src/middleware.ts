import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "dw_session";

/**
 * Edge guard: redirects anonymous requests away from /app/* and /admin/*.
 * Full session validation (DB lookup, role, tenant status) happens in the
 * server layouts via src/lib/auth/guards.ts — the edge runtime has no DB.
 */
export function middleware(req: NextRequest) {
  const hasCookie = Boolean(req.cookies.get(SESSION_COOKIE)?.value);
  const { pathname } = req.nextUrl;

  if (!hasCookie) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/admin/:path*"],
};
