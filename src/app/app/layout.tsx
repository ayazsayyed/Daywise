import { AppShell } from "@/components/app/shell";
import { requireTenant } from "@/lib/auth/guards";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireTenant();
  return <AppShell session={session}>{children}</AppShell>;
}
