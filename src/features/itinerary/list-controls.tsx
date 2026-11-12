"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";

/** Search box (PNG 06): "/" focuses it; typing updates ?q= after a short pause. */
export function ListSearch({ className }: { className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test(t.tagName) && !t.isContentEditable) {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (q.trim()) next.set("q", q.trim());
      else next.delete("q");
      next.delete("show");
      const qs = next.toString();
      if (qs !== params.toString()) router.replace(qs ? `${pathname}?${qs}` : pathname);
    }, 250);
    return () => clearTimeout(t);
  }, [q, params, pathname, router]);

  return (
    <label className={cn("relative block", className)}>
      <span className="sr-only">Search itineraries</span>
      <Search
        aria-hidden
        className="text-ink-secondary pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
      />
      <input
        ref={ref}
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search client, destination or city"
        className="focus-ring border-line-strong bg-surface-raised text-body text-ink placeholder:text-ink-muted focus-visible:border-indigo h-10 w-full rounded-md border pr-10 pl-9"
      />
      <kbd className="border-line text-caption text-ink-muted pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded-sm border px-1.5 sm:block">
        /
      </kbd>
    </label>
  );
}

export function ListSort({ value }: { value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <label className="text-body-sm text-ink-secondary flex items-center gap-2">
      Sort:
      <select
        value={value}
        onChange={(e) => {
          const next = new URLSearchParams(params.toString());
          if (e.target.value === "updated") next.delete("sort");
          else next.set("sort", e.target.value);
          const qs = next.toString();
          router.replace(qs ? `${pathname}?${qs}` : pathname);
        }}
        className="focus-ring text-body-sm text-ink rounded-sm bg-transparent font-medium"
      >
        <option value="updated">Last updated</option>
        <option value="dates">Trip dates</option>
        <option value="viewed">Last viewed</option>
      </select>
    </label>
  );
}
