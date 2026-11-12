/**
 * Fixed-window rate limiter, in process memory. The app runs as one Node
 * process (one `app` container), so a Map is the whole store — no Redis
 * (CLAUDE.md: no new infrastructure). Counters reset on deploy, which is fine
 * for abuse limits. Expired windows are swept as the map grows.
 */
export type RateLimitRule = { limit: number; windowMs: number };

export const RULES = {
  /** Magic-link requests per email (Day 5 brief: 5 per 15 minutes). */
  loginEmail: { limit: 5, windowMs: 15 * 60_000 },
  /** Magic-link requests per IP, across emails. */
  loginIp: { limit: 20, windowMs: 15 * 60_000 },
  /** Public share page opens per IP (Day 5 brief: 60 per minute). */
  sharePage: { limit: 60, windowMs: 60_000 },
  /** Photo proxy per IP; a day page loads ~10 photos, the editor more. */
  photo: { limit: 300, windowMs: 60_000 },
} satisfies Record<string, RateLimitRule>;

type Window = { start: number; count: number };

export type RateLimitResult = { ok: boolean; remaining: number; retryAfterSec: number };

export function createLimiter(maxKeys = 50_000) {
  const store = new Map<string, Window>();

  function sweep(now: number, windowMs: number) {
    for (const [k, w] of store) if (now - w.start >= windowMs) store.delete(k);
  }

  return {
    hit(key: string, rule: RateLimitRule, now = Date.now()): RateLimitResult {
      let w = store.get(key);
      if (!w || now - w.start >= rule.windowMs) {
        if (store.size >= maxKeys) sweep(now, rule.windowMs);
        w = { start: now, count: 0 };
        store.set(key, w);
      }
      w.count += 1;
      const ok = w.count <= rule.limit;
      return {
        ok,
        remaining: Math.max(0, rule.limit - w.count),
        retryAfterSec: ok ? 0 : Math.ceil((w.start + rule.windowMs - now) / 1000),
      };
    },
    reset() {
      store.clear();
    },
    size: () => store.size,
  };
}

// One limiter per module instance (the middleware and the server bundle each get their own).
const globalForLimiter = globalThis as unknown as {
  __dwLimiter?: ReturnType<typeof createLimiter>;
};
export const limiter = (globalForLimiter.__dwLimiter ??= createLimiter());

/** First address in X-Forwarded-For (set by Caddy), else X-Real-IP. */
export function ipFrom(h: Headers): string {
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return h.get("x-real-ip")?.trim() || "unknown";
}
