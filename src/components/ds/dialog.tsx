"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

/**
 * Native <dialog> (focus trap, Escape, inert background for free). Scrim
 * behind; raised panel with hairline + shadow-float, radius-lg. `variant="sheet"`
 * docks to the bottom on phones (PNG 18 action sheet).
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  variant = "dialog",
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  variant?: "dialog" | "sheet";
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-label={title}
      className={cn(
        "border-line bg-surface-raised text-ink shadow-float backdrop:bg-scrim border p-0",
        variant === "dialog"
          ? "m-auto w-[calc(100%-32px)] max-w-[440px] rounded-lg"
          : "mx-0 mt-auto mb-0 w-full max-w-none rounded-t-lg",
        className,
      )}
    >
      {open && (
        <div className="flex flex-col gap-4 p-5">
          {variant === "sheet" && (
            <span aria-hidden className="bg-line mx-auto -mt-2 h-1 w-10 rounded-sm" />
          )}
          <div className="flex flex-col gap-1">
            <h2 className="text-heading-2 text-ink">{title}</h2>
            {description ? (
              <div className="text-body-sm text-ink-secondary">{description}</div>
            ) : null}
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
