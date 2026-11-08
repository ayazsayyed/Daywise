import * as React from "react";

import { cn } from "@/lib/utils";

/** 40px tall, raised ground, line-strong border, 2px indigo focus ring. */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "focus-ring border-line-strong bg-surface-raised text-body text-ink placeholder:text-ink-muted disabled:border-line disabled:text-ink-muted flex h-10 w-full min-w-0 rounded-md border px-3 transition-colors disabled:cursor-not-allowed",
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium",
        "focus-visible:border-indigo aria-invalid:border-danger",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
