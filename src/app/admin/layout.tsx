import { TopBar } from "@/components/ds";
import { requireSuperadmin } from "@/lib/auth/guards";
import { initialsOf } from "@/lib/config/brand";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSuperadmin();
  return (
    <>
      <TopBar
        brand="Daywise admin"
        brandHref="/admin"
        nav={[{ href: "/admin", label: "Tenants", exact: true }]}
        menuLinks={session.tenant ? [{ href: "/app", label: `Open ${session.tenant.name}` }] : []}
        email={session.user.email}
        initials={initialsOf(session.user.email)}
      />
      {children}
    </>
  );
}
