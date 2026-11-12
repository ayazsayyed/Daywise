"use client";

import { useLayoutEffect, useRef } from "react";

import { cn } from "@/lib/utils";

/**
 * Text that edits in place: reads as plain type until hovered (sunken tint) or
 * focused (raised ground + indigo ring). Multiline grows with its content.
 * The parent owns the value; every keystroke dispatches an op (debounced save).
 */
export function InlineText({
  value,
  onChange,
  label,
  placeholder,
  multiline,
  maxLength,
  className,
  onEnter,
}: {
  value: string;
  onChange: (next: string) => void;
  label: string;
  placeholder?: string;
  multiline?: boolean;
  maxLength?: number;
  className?: string;
  /** Single-line only: called on Enter (e.g. blur or create the next row). */
  onEnter?: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  const base = cn(
    "-mx-1.5 w-[calc(100%+12px)] rounded-sm bg-transparent px-1.5 outline-none transition-colors",
    "placeholder:text-ink-muted hover:bg-surface-sunken/70",
    "focus:bg-surface-raised focus-visible:ring-2 focus-visible:ring-indigo focus:ring-2 focus:ring-indigo",
    className,
  );

  if (multiline) {
    return (
      <textarea
        ref={ref}
        rows={1}
        value={value}
        aria-label={label}
        placeholder={placeholder}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        className={cn(base, "block resize-none overflow-hidden")}
      />
    );
  }
  return (
    <input
      value={value}
      aria-label={label}
      placeholder={placeholder}
      maxLength={maxLength}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          if (onEnter) onEnter();
          else (e.target as HTMLInputElement).blur();
        }
      }}
      className={cn(base, "block")}
    />
  );
}

/** 24h "HH:MM" in storage; the browser renders its own 12h/24h picker. Empty → null. */
export function InlineTime({
  value,
  onChange,
  label,
  className,
}: {
  value: string | null;
  onChange: (next: string | null) => void;
  label: string;
  className?: string;
}) {
  return (
    <input
      type="time"
      value={value ?? ""}
      aria-label={label}
      onChange={(e) => onChange(e.target.value || null)}
      className={cn(
        "text-body-sm text-ink-muted tnum -mx-1 w-[88px] rounded-sm bg-transparent px-1 outline-none",
        "hover:bg-surface-sunken/70 focus:bg-surface-raised focus:ring-indigo focus:ring-2",
        "[&::-webkit-calendar-picker-indicator]:hidden",
        className,
      )}
    />
  );
}
