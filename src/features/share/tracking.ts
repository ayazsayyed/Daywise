import { createHash } from "node:crypto";

/**
 * Share-link view tracking (Day 4 build 3, Part 2 deviation 7): a page open
 * counts once per hour per device; known bots and link-preview fetchers never
 * count. Only a salted hash of IP + user agent is kept, never the raw IP.
 */

// Crawlers, link unfurlers (WhatsApp, Slack, Telegram…), headless browsers and
// HTTP libraries. Unfurlers matter most: sharing on WhatsApp fetches the link.
const BOT_UA =
  /bot\b|bot\/|crawl|spider|slurp|preview|facebookexternalhit|facebot|whatsapp|telegram|slack|discord|skype|linkedin|pinterest|embedly|vkshare|quora link|outbrain|bitlybot|google-?inspectiontool|lighthouse|pagespeed|headless|phantomjs|playwright|puppeteer|selenium|curl\/|wget\/|httpie|python-requests|python-urllib|aiohttp|go-http-client|okhttp|java\/|libwww|axios|node-fetch|undici|postman|insomnia/i;

export function isBotUA(ua: string | null | undefined): boolean {
  const s = (ua ?? "").trim();
  if (s.length < 10) return true; // empty or junk UAs are not people
  return BOT_UA.test(s);
}

export function deviceOf(ua: string | null | undefined): "mobile" | "desktop" {
  return /mobi|android|iphone|ipod|ipad|phone/i.test(ua ?? "") ? "mobile" : "desktop";
}

/** Start of the UTC hour: the de-dupe bucket. */
export function hourBucket(at: Date): Date {
  const d = new Date(at);
  d.setUTCMinutes(0, 0, 0);
  return d;
}

export function visitorHash(ip: string, ua: string, salt: string): string {
  return createHash("sha256").update(`${salt}|${ip.trim()}|${ua.trim()}`).digest("base64url");
}

/** First address in X-Forwarded-For (Caddy sets it), else X-Real-IP. */
export function clientIp(headers: { get(name: string): string | null }): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return headers.get("x-real-ip")?.trim() ?? "";
}
