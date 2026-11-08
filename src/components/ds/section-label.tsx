import { cn } from "@/lib/utils";

/** Eyebrow / column header / field label text: label token in ink-secondary. */
export function SectionLabel({
  as: Tag = "p",
  className,
  ...props
}: React.ComponentProps<"p"> & { as?: "p" | "span" | "h2" | "h3" | "div" }) {
  return <Tag className={cn("text-label text-ink-secondary", className)} {...props} />;
}
