import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * shadcn button with Daywise tokens: 40px tall, 14px/600, radius-md.
 * Variants per DESIGN.md — primary (indigo), secondary (raised + line-strong),
 * quiet (text + icon), destructive (danger outline). One primary per screen.
 */
const buttonVariants = cva(
  "focus-ring inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-button transition-colors disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-indigo text-on-indigo hover:bg-indigo-hover active:bg-indigo-hover disabled:bg-indigo/45",
        secondary:
          "border border-line-strong bg-surface-raised text-ink hover:bg-surface-sunken disabled:border-line disabled:text-ink-muted/60",
        outline:
          "border border-line-strong bg-surface-raised text-ink hover:bg-surface-sunken disabled:border-line disabled:text-ink-muted/60",
        ghost: "text-ink hover:bg-surface-sunken disabled:text-ink-muted/60",
        destructive:
          "border border-danger bg-transparent text-danger hover:bg-danger/5 disabled:border-danger/40 disabled:text-danger/40",
        link: "h-auto rounded-none px-0 font-medium text-indigo underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-8 px-3 text-body-sm font-medium",
        lg: "h-12 px-5 text-[15px]",
        icon: "size-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
