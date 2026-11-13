import { describe, expect, it } from "vitest";

import { adminHostRedirect } from "./hosts";

const APP = "https://daywise.smallsoftware.in";
const SUB = "shreekrishnatravelworld.daywise.smallsoftware.in";

describe("adminHostRedirect (#20)", () => {
  it("sends sign-in links opened on a tenant subdomain to the app host, token intact", () => {
    expect(adminHostRedirect(SUB, "/auth/verify", "?token=abc", APP)).toBe(
      `${APP}/auth/verify?token=abc`,
    );
  });

  it("moves /login, /app, /admin and / on a tenant subdomain to the app host", () => {
    expect(adminHostRedirect(SUB, "/login", "", APP)).toBe(`${APP}/login`);
    expect(adminHostRedirect(SUB, "/app/i/1", "", APP)).toBe(`${APP}/app/i/1`);
    expect(adminHostRedirect(`${SUB}:443`, "/admin", "", APP)).toBe(`${APP}/admin`);
    expect(adminHostRedirect(SUB, "/", "", APP)).toBe(`${APP}/`);
  });

  it("never redirects the server's own internal requests (server-action redirect render)", () => {
    // Next renders a server action's redirect target by fetching itself on its
    // listen address; bouncing that to APP_URL drops the session cookie.
    for (const h of ["localhost:3000", "0.0.0.0:3000", "127.0.0.1:3000", "app:3000", "172.18.0.5:3000"])
      expect(adminHostRedirect(h, "/app", "", APP)).toBeNull();
  });

  it("leaves other hosts (custom domains) alone", () => {
    expect(adminHostRedirect("itinerary.agency.com", "/admin", "", APP)).toBeNull();
    expect(adminHostRedirect("evil-daywise.smallsoftware.in", "/login", "", APP)).toBeNull();
  });

  it("leaves share pages, APIs and static files on the tenant host", () => {
    for (const p of ["/s/tok", "/api/photo/x", "/api/health", "/_next/static/a.js", "/placeholder.svg"])
      expect(adminHostRedirect(SUB, p, "", APP)).toBeNull();
  });

  it("does nothing on the app host itself (any case, any port in dev)", () => {
    expect(adminHostRedirect("daywise.smallsoftware.in", "/login", "", APP)).toBeNull();
    expect(adminHostRedirect("DAYWISE.smallsoftware.in", "/login", "", APP)).toBeNull();
    expect(adminHostRedirect("localhost:3000", "/login", "", "http://localhost:3000")).toBeNull();
  });

  it("ignores missing hosts and internal hosts like the worker's app:3000", () => {
    expect(adminHostRedirect(null, "/login", "", APP)).toBeNull();
    expect(adminHostRedirect("app:3000", "/s/tok", "", APP)).toBeNull();
  });
});
