import { eq } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import type { ImageRef } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import type { PlaceResult } from "@/lib/places/client";
import { photoUrl } from "@/lib/places/photo";
import { publicUrlFor, putObject, r2Configured } from "@/lib/storage/r2";

/**
 * Image fallback chain: Place photo → Pexels/Wikimedia destination image
 * (stored in R2, cached 90 days by query) → branded SVG placeholder.
 * Every ImageRef carries `source`; `imageUrl` turns a ref into something an
 * <img> can load.
 */
const DEST_CACHE_MS = 90 * 24 * 60 * 60 * 1000;

export function placePhotoImage(place: PlaceResult): ImageRef | null {
  const p = place.photos[0];
  if (!p) return null;
  return {
    source: "place",
    ref: p.name,
    attribution: p.attribution,
    attribution_url: p.attributionUrl,
    width: p.widthPx,
    height: p.heightPx,
  };
}

export function placeholderImage(label: string, index = 0, color?: string): ImageRef {
  const params = new URLSearchParams({ label: label.slice(0, 60), i: String(index % 4) });
  if (color) params.set("color", color);
  return { source: "placeholder", ref: `/placeholder.svg?${params.toString()}`, attribution: null };
}

export function imageUrl(ref: ImageRef, width = 1200): string {
  switch (ref.source) {
    case "place":
      return photoUrl(ref.ref, width);
    case "pexels":
    case "wikimedia":
      return /^https?:\/\//.test(ref.ref) ? ref.ref : publicUrlFor(ref.ref);
    case "placeholder":
      return ref.ref;
  }
}

/** Human-readable credit to show wherever the image is displayed. */
export function imageCredit(ref: ImageRef): string | null {
  if (ref.source === "place")
    return ref.attribution ? `Photo: ${ref.attribution} · Google` : "Google";
  return ref.attribution ?? null;
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

/** Pexels or Wikimedia landscape for a destination query, cached in DB (+R2). */
export async function destinationImage(query: string): Promise<ImageRef | null> {
  const key = query.toLowerCase().replace(/\s+/g, " ").trim();
  if (env.MOCK_AI === "1") return null;

  const cached = await db.query.destinationImages.findFirst({
    where: eq(schema.destinationImages.query, key),
  });
  if (cached && cached.fetchedAt.getTime() > Date.now() - DEST_CACHE_MS) return cached.image;

  const found = (await fromPexels(key)) ?? (await fromWikimedia(key));
  if (!found) return null;

  const stored = await storeInR2(found, key);
  await db
    .insert(schema.destinationImages)
    .values({ query: key, image: stored, fetchedAt: new Date() })
    .onConflictDoUpdate({
      target: schema.destinationImages.query,
      set: { image: stored, fetchedAt: new Date() },
    });
  return stored;
}

type Remote = { ref: ImageRef; downloadUrl: string; contentType: string };

async function fromPexels(query: string): Promise<Remote | null> {
  if (!env.PEXELS_API_KEY) return null;
  try {
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=3&orientation=landscape&size=large`;
    const res = await fetch(url, {
      headers: { Authorization: env.PEXELS_API_KEY },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      photos?: {
        src?: { large2x?: string; large?: string };
        photographer?: string;
        photographer_url?: string;
        url?: string;
        width?: number;
        height?: number;
      }[];
    };
    const p = json.photos?.[0];
    const src = p?.src?.large2x ?? p?.src?.large;
    if (!p || !src) return null;
    return {
      downloadUrl: src,
      contentType: "image/jpeg",
      ref: {
        source: "pexels",
        ref: src,
        attribution: p.photographer ? `Photo by ${p.photographer} on Pexels` : "Pexels",
        attribution_url: p.url ?? p.photographer_url ?? null,
        width: p.width,
        height: p.height,
      },
    };
  } catch (err) {
    logger.warn({ err, query }, "Pexels lookup failed");
    return null;
  }
}

async function fromWikimedia(query: string): Promise<Remote | null> {
  try {
    const params = new URLSearchParams({
      action: "query",
      generator: "search",
      gsrsearch: `${query} filetype:bitmap`,
      gsrnamespace: "6",
      gsrlimit: "5",
      prop: "imageinfo",
      iiprop: "url|extmetadata|mime",
      iiurlwidth: "1200",
      format: "json",
      origin: "*",
    });
    const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
      headers: { "User-Agent": `Daywise/0.1 (${env.SUPPORT_EMAIL})` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      query?: {
        pages?: Record<
          string,
          {
            title?: string;
            imageinfo?: {
              thumburl?: string;
              mime?: string;
              descriptionurl?: string;
              extmetadata?: Record<string, { value?: string }>;
            }[];
          }
        >;
      };
    };
    const pages = Object.values(json.query?.pages ?? {});
    for (const page of pages) {
      const info = page.imageinfo?.[0];
      if (!info?.thumburl || !/^image\/(jpeg|png)$/.test(info.mime ?? "")) continue;
      const artist = strip(info.extmetadata?.Artist?.value ?? "");
      const licence = info.extmetadata?.LicenseShortName?.value ?? "";
      return {
        downloadUrl: info.thumburl,
        contentType: info.mime ?? "image/jpeg",
        ref: {
          source: "wikimedia",
          ref: info.thumburl,
          attribution: [artist, licence, "Wikimedia Commons"].filter(Boolean).join(" · "),
          attribution_url: info.descriptionurl ?? null,
        },
      };
    }
    return null;
  } catch (err) {
    logger.warn({ err, query }, "Wikimedia lookup failed");
    return null;
  }
}

/** Copies the picked image into R2 so we serve it ourselves; keeps the remote URL if R2 is off. */
async function storeInR2(remote: Remote, key: string): Promise<ImageRef> {
  if (!r2Configured()) return remote.ref;
  try {
    const res = await fetch(remote.downloadUrl, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return remote.ref;
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length > 8 * 1024 * 1024) return remote.ref;
    const ext = remote.contentType === "image/png" ? "png" : "jpg";
    const objectKey = `images/${remote.ref.source}/${slug(key)}.${ext}`;
    await putObject(objectKey, bytes, remote.contentType, "public, max-age=2592000");
    return { ...remote.ref, ref: objectKey };
  } catch (err) {
    logger.warn({ err, key }, "could not store destination image in R2");
    return remote.ref;
  }
}

function strip(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .trim()
    .slice(0, 120);
}
