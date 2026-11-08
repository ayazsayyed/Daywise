/**
 * Photo references. We store Google photo resource names
 * (`places/{id}/photos/{ref}`) and never bytes; the browser loads them via
 * `/api/photo/[ref]`, which proxies the Places media endpoint with a ≤30-day
 * cache and max width 1200.
 */
export const PHOTO_MAX_WIDTH = 1200;
export const PHOTO_CACHE_SECONDS = 30 * 24 * 60 * 60;

const NAME = /^places\/[^/]+\/photos\/[^/]+$/;

export function encodePhotoRef(resourceName: string): string {
  if (!NAME.test(resourceName)) throw new Error("not a Places photo resource name");
  return Buffer.from(resourceName, "utf8").toString("base64url");
}

export function decodePhotoRef(ref: string): string | null {
  if (!/^[A-Za-z0-9_-]{8,400}$/.test(ref)) return null;
  const name = Buffer.from(ref, "base64url").toString("utf8");
  return NAME.test(name) ? name : null;
}

export function placeIdOf(resourceName: string): string {
  return resourceName.split("/")[1] ?? "";
}

export function photoUrl(resourceName: string, width = PHOTO_MAX_WIDTH): string {
  const w = Math.min(PHOTO_MAX_WIDTH, Math.max(100, Math.round(width)));
  return `/api/photo/${encodePhotoRef(resourceName)}?w=${w}`;
}
