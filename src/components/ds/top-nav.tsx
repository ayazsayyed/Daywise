"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export type NavItem = { href: string; label: string; exact?: boolean };

export function isActivePath(pathname: string, item: NavItem): boolean {
  return item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/** Text navigation: active item in ink/500, the rest in ink-secondary. */
export function TopNav({ items, className }: { items: NavItem[]; className?: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className={cn("items-center gap-6", className)}>
      {items.map((item) => {
        const active = isActivePath(pathname, item);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "focus-ring rounded-sm text-[14px] leading-5 transition-colors",
              active ? "text-ink font-medium" : "text-ink-secondary hover:text-ink",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
