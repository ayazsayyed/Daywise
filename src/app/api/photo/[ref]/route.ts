import { NextResponse, type NextRequest } from "next/server";

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { placesBudget } from "@/lib/places/budget";
import { cachedPlace } from "@/lib/places/client";
import {
  decodePhotoRef,
  PHOTO_CACHE_SECONDS,
  PHOTO_MAX_WIDTH,
  placeIdOf,
} from "@/lib/places/photo";

export const dynamic = "force-dynamic";

const MEDIA = "https://places.googleapis.com/v1";

/**
 * Public photo proxy: `/api/photo/[ref]?w=1200`. Resolves the Places media
 * URL server-side (key never reaches the browser), streams the bytes with a
 * 30-day cache and an attribution header, and counts against the monthly
 * photo budget. When the budget is gone, redirects to the branded placeholder.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ ref: string }> }) {
  const { ref } = await ctx.params;
  const name = decodePhotoRef(ref);
  if (!name) return new NextResponse("bad ref", { status: 400 });

  const wParam = Number(req.nextUrl.searchParams.get("w") ?? PHOTO_MAX_WIDTH);
  const width = Math.min(
    PHOTO_MAX_WIDTH,
    Math.max(100, Number.isFinite(wParam) ? wParam : PHOTO_MAX_WIDTH),
  );

  const qParam = Number(req.nextUrl.searchParams.get("q") ?? "");
  const quality = Number.isInteger(qParam) && qParam >= 40 && qParam <= 90 ? qParam : null;

  const place = await cachedPlace(placeIdOf(name)).catch(() => null);
  const photo = place?.photos.find((p) => p.name === name) ?? place?.photos[0];
  const label = place?.name ?? "Photo";
  const fallback = () =>
    NextResponse.redirect(
      new URL(`/placeholder.svg?label=${encodeURIComponent(label)}`, req.url),
      302,
    );

  if (!env.GOOGLE_PLACES_API_KEY) return fallback();
  const allowed = await placesBudget().spend("places_photo", null);
  if (!allowed) return fallback();

  try {
    // Key in a header, never in the URL (keeps it out of logs and proxies).
    const meta = await fetch(`${MEDIA}/${name}/media?maxWidthPx=${width}&skipHttpRedirect=true`, {
      headers: { "X-Goog-Api-Key": env.GOOGLE_PLACES_API_KEY },
      signal: AbortSignal.timeout(10_000),
    });
    if (!meta.ok) {
      logger.warn({ status: meta.status, name }, "photo media lookup failed");
      return fallback();
    }
    const { photoUri } = (await meta.json()) as { photoUri?: string };
    if (!photoUri) return fallback();

    const img = await fetch(photoUri, { signal: AbortSignal.timeout(15_000) });
    if (!img.ok || !img.body) return fallback();

    const headers = new Headers({
      "Content-Type": img.headers.get("content-type") ?? "image/jpeg",
      "Cache-Control": `public, max-age=${PHOTO_CACHE_SECONDS}, s-maxage=${PHOTO_CACHE_SECONDS}, immutable`,
      "X-Photo-Source": "google-places",
      "X-Photo-Width": String(width),
    });
    if (photo?.attribution) headers.set("X-Photo-Attribution", asciiSafe(photo.attribution));
    if (photo?.attributionUrl) headers.set("X-Photo-Attribution-Url", photo.attributionUrl);
    // PDF print targets (Part 2): `?q=72` re-encodes to a compact progressive JPEG.
    if (quality) {
      const { default: sharp } = await import("sharp");
      const out = await sharp(Buffer.from(await img.arrayBuffer()))
        .rotate()
        .resize({ width, withoutEnlargement: true })
        .jpeg({ quality, progressive: true, mozjpeg: true })
        .toBuffer();
      headers.set("Content-Type", "image/jpeg");
      headers.set("Content-Length", String(out.length));
      return new NextResponse(new Uint8Array(out), { status: 200, headers });
    }
    const len = img.headers.get("content-length");
    if (len) headers.set("Content-Length", len);
    return new NextResponse(img.body, { status: 200, headers });
  } catch (err) {
    logger.error({ err, name }, "photo proxy failed");
    return fallback();
  }
}

/** HTTP header values must be ISO-8859-1; percent-encode anything else. */
function asciiSafe(s: string): string {
  return /^[\x20-\x7e]*$/.test(s) ? s : encodeURIComponent(s);
}
