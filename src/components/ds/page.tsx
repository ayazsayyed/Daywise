import { cn } from "@/lib/utils";

/** Page gutter: 16 on phones, 32 on tablets, 96 (space-9) from 1280px. */
export function Page({ className, ...props }: React.ComponentProps<"main">) {
  return (
    <main className={cn("px-4 pt-10 pb-24 sm:px-8 lg:pt-16 xl:px-24", className)} {...props} />
  );
}

/** display-2 page title with an optional body-sm subtitle beneath. */
export function PageTitle({
  title,
  subtitle,
  className,
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-6", className)}>
      <div className="flex flex-col gap-2">
        <h1 className="text-display-2 text-ink">{title}</h1>
        {subtitle && <p className="text-body text-ink-secondary">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
