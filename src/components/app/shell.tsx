import Link from "next/link";
import { LogOut, Settings, ShieldCheck, Map } from "lucide-react";

import { Wordmark } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";
import type { CurrentSession } from "@/lib/auth/session";
import { NavLink } from "./nav-link";

export function AppShell({
  session,
  children,
}: {
  session: CurrentSession;
  children: React.ReactNode;
}) {
  const tenant = session.tenant;
  const isSuper = session.user.role === "superadmin";

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="bg-card flex flex-col gap-6 border-b px-4 py-4 lg:sticky lg:top-0 lg:h-dvh lg:border-r lg:border-b-0 lg:px-5 lg:py-6">
        <div className="flex items-center justify-between">
          <Link
            href="/app"
            className="focus-visible:outline-ring rounded-md focus-visible:outline-2"
          >
            <Wordmark />
          </Link>
          <form action="/logout" method="post" className="lg:hidden">
            <Button variant="ghost" size="icon" type="submit" aria-label="Sign out">
              <LogOut />
            </Button>
          </form>
        </div>

        <nav aria-label="Main" className="flex gap-1 overflow-x-auto lg:flex-col">
          <NavLink href="/app" exact icon={<Map />}>
            Itineraries
          </NavLink>
          <NavLink href="/app/settings" icon={<Settings />}>
            Settings
          </NavLink>
          {isSuper && (
            <NavLink href="/admin" icon={<ShieldCheck />}>
              Admin
            </NavLink>
          )}
        </nav>

        <div className="mt-auto hidden lg:block">
          <div className="bg-background rounded-lg border p-3">
            <p className="truncate text-sm font-medium">{tenant?.name ?? "No agency"}</p>
            <p className="text-muted-foreground truncate text-xs" title={session.user.email}>
              {session.user.email}
            </p>
            <form action="/logout" method="post" className="mt-3">
              <Button variant="outline" size="sm" type="submit" className="w-full">
                <LogOut /> Sign out
              </Button>
            </form>
          </div>
        </div>
      </aside>

      <main className="min-w-0 px-4 py-6 sm:px-8 lg:px-12 lg:py-10">{children}</main>
    </div>
  );
}
