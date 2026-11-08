import { AppShell } from "@/components/app/shell";
import { requireSuperadmin } from "@/lib/auth/guards";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSuperadmin();
  return <AppShell session={session}>{children}</AppShell>;
}
