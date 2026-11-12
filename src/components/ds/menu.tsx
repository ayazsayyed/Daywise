"use client";

import { useEffect, useId, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export type MenuItem =
  | {
      label: string;
      onSelect: () => void;
      icon?: React.ReactNode;
      danger?: boolean;
      disabled?: boolean;
      hint?: string;
    }
  | "separator";

/**
 * Small dropdown: raised, hairline + shadow-float, radius-md. Closes on
 * outside click, Escape and selection. Arrow keys move between items.
 */
export function Menu({
  trigger,
  items,
  align = "right",
  label,
  className,
}: {
  trigger: (props: {
    "aria-haspopup": "menu";
    "aria-expanded": boolean;
    "aria-controls": string;
    "aria-label"?: string;
    onClick: () => void;
  }) => React.ReactNode;
  items: MenuItem[];
  align?: "left" | "right";
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const els = [
          ...(ref.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]:not(:disabled)") ??
            []),
        ];
        const i = els.indexOf(document.activeElement as HTMLButtonElement);
        const next =
          e.key === "ArrowDown" ? (i + 1) % els.length : (i - 1 + els.length) % els.length;
        els[next]?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    ref.current?.querySelector<HTMLButtonElement>("[role=menuitem]:not(:disabled)")?.focus();
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={cn("relative", className)}>
      {trigger({
        "aria-haspopup": "menu",
        "aria-expanded": open,
        "aria-controls": id,
        ...(label ? { "aria-label": label } : {}),
        onClick: () => setOpen((o) => !o),
      })}
      {open && (
        <div
          id={id}
          role="menu"
          className={cn(
            "border-line bg-surface-raised shadow-float absolute top-full z-40 mt-2 min-w-[220px] rounded-md border p-1",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {items.map((item, i) =>
            item === "separator" ? (
              <div key={`sep-${i}`} role="separator" className="bg-line my-1 h-px" />
            ) : (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                title={item.hint}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
                className={cn(
                  "focus-ring text-body-sm hover:bg-surface-sunken focus:bg-surface-sunken flex h-9 w-full items-center gap-2.5 rounded-[5px] px-2.5 text-left outline-none disabled:opacity-50",
                  item.danger ? "text-danger" : "text-ink",
                )}
              >
                {item.icon ? (
                  <span aria-hidden className="text-ink-secondary [&_svg]:size-4">
                    {item.icon}
                  </span>
                ) : null}
                {item.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
