/**
 * Tenant subdomains and custom domains serve the client share page only (#20).
 * The admin product (sign-in, /app, /admin) lives on the APP_URL host, where
 * the host-only session cookie is set. A sign-in finished on a tenant host
 * would set the cookie there and then redirect to APP_URL without it, so the
 * agent landed back on /login with the single-use link already spent.
 * Returns the APP_URL address to redirect to, or null to serve the request.
 */
const TENANT_HOST_PATHS = /^\/(s\/|api\/|_next\/|placeholder\.svg|favicon|robots\.txt)/;

export function adminHostRedirect(
  host: string | null,
  pathname: string,
  search: string,
  appUrl: string,
): string | null {
  if (!host) return null;
  if (TENANT_HOST_PATHS.test(pathname)) return null;
  const app = new URL(appUrl);
  if (host.toLowerCase() === app.host.toLowerCase()) return null;
  return `${app.origin}${pathname}${search}`;
}
