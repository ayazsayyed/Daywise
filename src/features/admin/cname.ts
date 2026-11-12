/**
 * CNAME checker (Day 5 brief 1). A tenant's custom domain is correct when it
 * CNAMEs to the tenant's subdomain (or the app host), or — for an apex domain,
 * which cannot carry a CNAME — when its A records are exactly the app's IPs.
 * Pure so it can be unit-tested; DNS lookups live in the action.
 */
export type CnameVerdict = {
  ok: boolean;
  /** One line for the admin: what is wrong or "Points at Daywise". */
  summary: string;
};

const norm = (h: string) => h.trim().toLowerCase().replace(/\.$/, "");

export function cnameVerdict(input: {
  expectedTargets: string[];
  appIps: string[];
  cnames: string[];
  aRecords: string[];
}): CnameVerdict {
  const targets = input.expectedTargets.map(norm);
  const cnames = input.cnames.map(norm);
  if (cnames.length) {
    const hit = cnames.find((c) => targets.includes(c));
    return hit
      ? { ok: true, summary: `CNAME points at ${hit}` }
      : { ok: false, summary: `CNAME points at ${cnames.join(", ")}, not ${targets[0]}` };
  }
  if (!input.aRecords.length)
    return { ok: false, summary: "No CNAME or A record found. Add the CNAME and wait for DNS." };
  const app = new Set(input.appIps);
  const allMatch = input.aRecords.every((ip) => app.has(ip));
  return allMatch && app.size > 0
    ? { ok: true, summary: `A record points at ${input.aRecords.join(", ")} (the Daywise server)` }
    : {
        ok: false,
        summary: `A record points at ${input.aRecords.join(", ")}; expected a CNAME to ${targets[0]}${app.size ? ` or A ${[...app].join(", ")}` : ""}`,
      };
}

export const HOSTNAME_RE = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/;
export const RESERVED_SLUGS = new Set([
  "www",
  "app",
  "admin",
  "api",
  "mail",
  "smtp",
  "login",
  "static",
  "assets",
  "status",
  "help",
  "support",
  "daywise",
]);
