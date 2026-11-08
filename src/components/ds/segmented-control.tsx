"use client";

import { cn } from "@/lib/utils";

export type Segment<T extends string> = { value: T; label: string; disabled?: boolean };

/** Sunken track; the active segment is raised with a hairline. */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  segments,
  name,
  ariaLabel,
  className,
}: {
  value: T;
  onChange: (next: T) => void;
  segments: Segment<T>[];
  /** When set, a hidden input carries the value in a form post. */
  name?: string;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "bg-surface-sunken inline-flex h-10 items-center gap-0.5 rounded-md p-0.5",
        className,
      )}
    >
      {name ? <input type="hidden" name={name} value={value} /> : null}
      {segments.map((s) => {
        const active = s.value === value;
        return (
          <button
            key={s.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={s.disabled}
            onClick={() => onChange(s.value)}
            className={cn(
              "focus-ring text-body-sm h-full rounded-[5px] px-3 whitespace-nowrap transition-colors",
              active
                ? "border-line bg-surface-raised text-ink border font-medium"
                : "text-ink-secondary hover:text-ink disabled:text-ink-muted/60",
            )}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}
