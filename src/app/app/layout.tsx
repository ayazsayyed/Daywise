import { requireTenant } from "@/lib/auth/guards";

/** Every /app route needs a tenant session. Bars differ per area: (main) list/settings, new flow, editor. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireTenant();
  return children;
}
