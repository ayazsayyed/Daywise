import { TopBar } from "@/components/ds";
import { requireTenant } from "@/lib/auth/guards";
import { initialsOf } from "@/lib/config/brand";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireTenant();
  const isSuper = session.user.role === "superadmin";
  return (
    <>
      <TopBar
        brand={session.tenant.name}
        brandHref="/app"
        nav={[
          { href: "/app", label: "Itineraries", exact: true },
          { href: "/app/settings", label: "Settings" },
        ]}
        menuLinks={isSuper ? [{ href: "/admin", label: "Daywise admin" }] : []}
        email={session.user.email}
        initials={initialsOf(session.user.email)}
      />
      {children}
    </>
  );
}
