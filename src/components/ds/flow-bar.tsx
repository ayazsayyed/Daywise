import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Focused-task bar (PNG 08–11, 19): back link left, context centred, actions
 * right. 56px, surface, hairline below — same skeleton as the top bar, no nav.
 */
export function FlowBar({
  backHref,
  backLabel,
  center,
  children,
  className,
}: {
  backHref: string;
  backLabel?: string;
  center?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("border-line bg-surface sticky top-0 z-30 h-14 border-b", className)}>
      <div className="relative flex h-full items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          href={backHref}
          aria-label={backLabel ? undefined : "Back"}
          className="focus-ring text-body-sm text-ink-secondary hover:text-ink flex shrink-0 items-center gap-1.5 rounded-sm"
        >
          <ChevronLeft aria-hidden className="size-4" />
          {backLabel ? <span>{backLabel}</span> : null}
        </Link>
        {center ? (
          <div className="text-body-sm text-ink-secondary pointer-events-none absolute inset-x-0 hidden text-center sm:block">
            {center}
          </div>
        ) : null}
        <div className="ml-auto flex min-w-0 items-center gap-3">{children}</div>
      </div>
    </header>
  );
}
