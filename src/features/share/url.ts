/**
 * Public URL for a share token, custom-domain aware: the tenant's own domain
 * when set, else `<slug>.<app host>`; plain APP_URL on localhost (dev).
 * Caddy's on-demand TLS approves exactly these hosts (`/api/tls-check`).
 */
export function shareUrl(
  tenant: { slug: string; customDomain: string | null },
  token: string,
  appUrl: string,
): string {
  const app = new URL(appUrl);
  const local =
    /^(localhost|127\.0\.0\.1|\[::1\])$/.test(app.hostname) || app.hostname.endsWith(".localhost");
  if (local) return `${app.origin}/s/${token}`;
  const host = tenant.customDomain?.trim() || `${tenant.slug}.${app.hostname}`;
  return `https://${host}/s/${token}`;
}

/** "Kashmir for Ananya & Rohit" → "Kashmir-for-Ananya-Rohit.pdf" */
export function pdfFilename(title: string): string {
  const base = title
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
  return `${base || "itinerary"}.pdf`;
}
