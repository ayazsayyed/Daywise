import { cn } from "@/lib/utils";

/** Loading placeholder: sunken blocks, no shimmer, announced as busy. */
export function SkeletonPage({ rows = 6, label = "Loading" }: { rows?: number; label?: string }) {
  return (
    <main
      aria-busy="true"
      aria-label={label}
      className="px-4 pt-10 pb-24 sm:px-8 lg:pt-16 xl:px-24"
    >
      <div className="flex max-w-[1010px] flex-col gap-3">
        <Bar className="h-9 w-56" />
        <Bar className="h-5 w-80" />
        <div className="mt-8 flex flex-col">
          <Bar className="h-10 w-full rounded-sm" />
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="border-line flex h-[52px] items-center gap-6 border-b px-5">
              <Bar className="h-4 w-48" />
              <Bar className="ml-auto h-4 w-16" />
              <Bar className="h-4 w-16" />
            </div>
          ))}
        </div>
        <span className="sr-only">{label}…</span>
      </div>
    </main>
  );
}

function Bar({ className }: { className?: string }) {
  return <span aria-hidden className={cn("bg-surface-sunken block rounded-md", className)} />;
}
