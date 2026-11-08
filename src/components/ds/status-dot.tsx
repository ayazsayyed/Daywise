import { cn } from "@/lib/utils";

export type ItineraryStatus = "draft" | "sent" | "confirmed" | "lost";
export type TenantStatus = "trial" | "active" | "suspended";

const ITINERARY: Record<ItineraryStatus, { dot: string; text: string; word: string }> = {
  draft: { dot: "bg-ink-muted", text: "text-ink", word: "Draft" },
  sent: { dot: "bg-amber", text: "text-ink", word: "Sent" },
  confirmed: { dot: "bg-green", text: "text-ink", word: "Confirmed" },
  lost: { dot: "bg-ink-muted/60", text: "text-ink-muted", word: "Lost" },
};

const TENANT: Record<TenantStatus, { dot: string; text: string; word: string }> = {
  trial: { dot: "bg-amber", text: "text-ink", word: "Trial" },
  active: { dot: "bg-green", text: "text-ink", word: "Active" },
  suspended: { dot: "bg-ink-muted/60", text: "text-ink-muted", word: "Suspended" },
};

/** Status is always a dot and a word — colour is never the only signal. */
export function StatusDot({
  status,
  kind = "itinerary",
  className,
}: {
  status: ItineraryStatus | TenantStatus;
  kind?: "itinerary" | "tenant";
  className?: string;
}) {
  const spec =
    kind === "tenant" ? TENANT[status as TenantStatus] : ITINERARY[status as ItineraryStatus];
  return (
    <span className={cn("text-body-sm inline-flex items-center gap-2", spec.text, className)}>
      <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", spec.dot)} />
      {spec.word}
    </span>
  );
}

/** Save-state line: "Saved · 12:41" green, "Saving…", "Unsaved changes" amber, "Not saved · Retry" danger. */
export function SaveState({
  state,
  at,
  onRetry,
  className,
}: {
  state: "idle" | "saving" | "saved" | "unsaved" | "failed";
  at?: string;
  onRetry?: () => void;
  className?: string;
}) {
  if (state === "idle") return null;
  if (state === "saving") {
    return (
      <span className={cn("text-body-sm text-ink-muted", className)} role="status">
        Saving…
      </span>
    );
  }
  if (state === "saved") {
    return (
      <span
        className={cn("text-body-sm text-green inline-flex items-center gap-2", className)}
        role="status"
      >
        <span aria-hidden className="bg-green size-1.5 rounded-full" />
        Saved{at ? ` · ${at}` : ""}
      </span>
    );
  }
  if (state === "unsaved") {
    return (
      <span className={cn("text-body-sm text-amber inline-flex items-center gap-2", className)}>
        <span aria-hidden className="bg-amber size-1.5 rounded-full" />
        Unsaved changes
      </span>
    );
  }
  return (
    <span className={cn("text-body-sm text-danger", className)} role="alert">
      Not saved
      {onRetry && (
        <>
          {" · "}
          <button type="button" onClick={onRetry} className="focus-ring rounded-sm underline">
            Retry
          </button>
        </>
      )}
    </span>
  );
}
