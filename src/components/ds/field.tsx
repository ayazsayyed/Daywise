import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Label above, 8px gap, control, then an optional hint or error caption.
 * `optional` renders "(optional)" after the label in sentence case.
 */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  optional,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: React.ReactNode;
  error?: string | boolean;
  optional?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const hintId = hint || error ? `${htmlFor}-hint` : undefined;
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {optional && (
          <span className="text-caption text-ink-muted font-normal tracking-normal normal-case">
            (optional)
          </span>
        )}
      </Label>
      {children}
      {typeof error === "string" && error ? (
        <p id={hintId} className="text-caption text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-caption text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
