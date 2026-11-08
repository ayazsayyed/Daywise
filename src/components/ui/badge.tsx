import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/** Tinted ground, radius-sm, never a pill. Colour is never the only signal. */
const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-sm px-2 py-0.5 text-body-sm font-medium [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "bg-surface-sunken text-ink-secondary",
        secondary: "bg-surface-sunken text-ink-secondary",
        verified: "bg-green-soft text-green",
        verify: "bg-amber-soft text-amber",
        destructive: "bg-danger/10 text-danger",
        outline: "border border-line text-ink-secondary",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
