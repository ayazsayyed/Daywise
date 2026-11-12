/**
 * PDF photo targets (Part 2 print-photo): Google photos go through our proxy
 * with `w` + `q` (sharp re-encode); Pexels CDN images take `w` (its own
 * compression). Other URLs (R2-stored copies, placeholders) are left alone.
 */
export function printSizedUrl(url: string, width: number, quality: number): string {
  if (url.startsWith("/api/photo/")) {
    const [path, query = ""] = url.split("?");
    const params = new URLSearchParams(query);
    params.set("w", String(width));
    params.set("q", String(quality));
    return `${path}?${params.toString()}`;
  }
  try {
    const u = new URL(url);
    if (u.hostname === "images.pexels.com") {
      u.searchParams.delete("h");
      u.searchParams.delete("dpr");
      u.searchParams.set("auto", "compress");
      u.searchParams.set("cs", "tinysrgb");
      u.searchParams.set("w", String(width));
      return u.toString();
    }
  } catch {
    /* relative or odd URL: leave it */
  }
  return url;
}
