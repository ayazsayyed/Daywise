import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "focus-ring border-line-strong bg-surface-raised text-body text-ink placeholder:text-ink-muted disabled:border-line disabled:text-ink-muted flex min-h-20 w-full rounded-md border px-3 py-2 transition-colors disabled:cursor-not-allowed",
        "focus-visible:border-indigo aria-invalid:border-danger",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
