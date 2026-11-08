import { cn } from "@/lib/utils";

export function Wordmark({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <span
      className={cn(
        "text-foreground inline-flex items-center gap-2 font-semibold tracking-tight",
        className,
      )}
    >
      <span
        aria-hidden
        className="bg-primary text-primary-foreground grid size-7 place-items-center rounded-md text-[13px] font-bold"
      >
        D
      </span>
      {!compact && <span className="text-[17px]">Daywise</span>}
    </span>
  );
}
