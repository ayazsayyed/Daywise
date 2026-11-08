"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { isActivePath, type NavItem } from "./top-nav";

/**
 * One menu, two triggers. On phones the brand name opens it (PNG 18: "Agency ⌄")
 * and carries the navigation; on desktop the initials avatar opens it with the
 * account row and sign out. Floats with shadow-float + hairline, radius-md.
 */
export function TopBarMenu({
  brand,
  brandHref,
  email,
  initials,
  items,
  variant,
}: {
  brand: string;
  brandHref: string;
  email: string;
  initials: string;
  items: NavItem[];
  variant: "brand" | "avatar";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => setOpen(false), [pathname]);

  if (variant === "brand") {
    return (
      <div ref={ref} className="relative flex min-w-0 items-center">
        {/* Desktop: plain brand link. */}
        <Link
          href={brandHref}
          className="focus-ring text-heading-3 text-ink hidden min-w-0 truncate rounded-sm md:block"
        >
          {brand}
        </Link>
        {/* Phone: brand opens the menu. */}
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((o) => !o)}
          className="focus-ring text-heading-3 text-ink flex min-w-0 items-center gap-1.5 rounded-sm md:hidden"
        >
          <span className="truncate">{brand}</span>
          <ChevronDown aria-hidden className="text-ink-secondary size-4 shrink-0" />
        </button>
        {open && (
          <Menu id={id} email={email} items={items} pathname={pathname} className="left-0" />
        )}
      </div>
    );
  }

  return (
    <div ref={ref} className="relative hidden md:block">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        aria-label={`Account menu for ${email}`}
        onClick={() => setOpen((o) => !o)}
        className="focus-ring border-line bg-surface-sunken text-ink grid size-8 place-items-center rounded-full border text-[12px] font-semibold"
      >
        {initials}
      </button>
      {open && <Menu id={id} email={email} items={items} pathname={pathname} className="right-0" />}
    </div>
  );
}

function Menu({
  id,
  email,
  items,
  pathname,
  className,
}: {
  id: string;
  email: string;
  items: NavItem[];
  pathname: string;
  className?: string;
}) {
  return (
    <div
      id={id}
      role="menu"
      className={cn(
        "border-line bg-surface-raised shadow-float absolute top-[calc(100%+10px)] z-30 w-64 rounded-md border py-1",
        className,
      )}
    >
      <p className="text-body-sm text-ink-muted truncate px-4 py-2.5" title={email}>
        {email}
      </p>
      <div className="bg-line mx-0 h-px" />
      {items.map((item) => (
        <Link
          key={item.href}
          role="menuitem"
          href={item.href}
          aria-current={isActivePath(pathname, item) ? "page" : undefined}
          className={cn(
            "text-body-sm text-ink hover:bg-surface-sunken focus-visible:bg-surface-sunken block px-4 py-2.5 focus-visible:outline-none",
            isActivePath(pathname, item) && "font-medium",
          )}
        >
          {item.label}
        </Link>
      ))}
      <div className="bg-line h-px" />
      <form action="/logout" method="post">
        <button
          type="submit"
          role="menuitem"
          className="text-body-sm text-ink hover:bg-surface-sunken focus-visible:bg-surface-sunken block w-full px-4 py-2.5 text-left focus-visible:outline-none"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
