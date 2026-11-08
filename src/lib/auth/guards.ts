import "server-only";

import { redirect } from "next/navigation";

import { getSession, type CurrentSession } from "./session";

/** Any logged-in user. */
export async function requireSession(): Promise<CurrentSession> {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}

/** Logged-in user attached to an active tenant — the only way to obtain a tenantId for queries. */
export async function requireTenant(): Promise<
  CurrentSession & { tenant: NonNullable<CurrentSession["tenant"]> }
> {
  const s = await requireSession();
  if (!s.tenant) redirect(s.user.role === "superadmin" ? "/admin" : "/no-tenant");
  if (s.tenant.status === "suspended" && s.user.role !== "superadmin") redirect("/suspended");
  return { ...s, tenant: s.tenant };
}

export async function requireSuperadmin(): Promise<CurrentSession> {
  const s = await requireSession();
  if (s.user.role !== "superadmin") redirect("/app");
  return s;
}
