import { describe, expect, it } from "vitest";

import { clientIp, deviceOf, hourBucket, isBotUA, visitorHash } from "./tracking";

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1";
const ANDROID =
  "Mozilla/5.0 (Linux; Android 15; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";
const MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

describe("isBotUA", () => {
  it("lets real phones and desktops through", () => {
    expect(isBotUA(IPHONE)).toBe(false);
    expect(isBotUA(ANDROID)).toBe(false);
    expect(isBotUA(MAC)).toBe(false);
  });
  it("ignores crawlers, link previews and scripts", () => {
    for (const ua of [
      "WhatsApp/2.24.6.77 A",
      "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "TelegramBot (like TwitterBot)",
      "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
      "curl/8.7.1",
      "python-requests/2.32.3",
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/131.0.0.0 Safari/537.36",
      "",
      null,
    ])
      expect(isBotUA(ua), String(ua)).toBe(true);
  });
});

describe("view de-dupe", () => {
  it("buckets by UTC hour", () => {
    expect(hourBucket(new Date("2026-11-12T10:59:59.900Z")).toISOString()).toBe(
      "2026-11-12T10:00:00.000Z",
    );
  });
  it("hashes the same device the same way, never the raw IP", () => {
    const a = visitorHash("49.36.1.2", IPHONE, "salt");
    expect(a).toBe(visitorHash("49.36.1.2", IPHONE, "salt"));
    expect(a).not.toBe(visitorHash("49.36.1.3", IPHONE, "salt"));
    expect(a).not.toContain("49.36");
  });
  it("tells mobile from desktop", () => {
    expect(deviceOf(IPHONE)).toBe("mobile");
    expect(deviceOf(ANDROID)).toBe("mobile");
    expect(deviceOf(MAC)).toBe("desktop");
  });
  it("reads the first forwarded address", () => {
    const h = new Headers({ "x-forwarded-for": "49.36.1.2, 10.0.0.1" });
    expect(clientIp(h)).toBe("49.36.1.2");
    expect(clientIp(new Headers())).toBe("");
  });
});
