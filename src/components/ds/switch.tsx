"use client";

import { cn } from "@/lib/utils";

/** Toggle: 36×20 track, 16px knob (DESIGN.md). Indigo when on. */
export function Switch({
  checked,
  onChange,
  id,
  label,
  className,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  id?: string;
  label: string;
  className?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "focus-ring relative inline-flex h-5 w-9 shrink-0 items-center rounded-[10px] border transition-colors",
        checked ? "border-indigo bg-indigo" : "border-line-strong bg-surface-sunken",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "bg-surface-raised absolute size-4 rounded-sm shadow-[0_1px_2px_rgba(28,27,25,0.2)] transition-transform",
          checked ? "translate-x-[17px]" : "translate-x-[1px]",
        )}
      />
    </button>
  );
}
