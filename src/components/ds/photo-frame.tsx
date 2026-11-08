import { cn } from "@/lib/utils";

export type PhotoRatio = "3:2" | "4:3" | "1:1" | "fill";

const RATIO: Record<PhotoRatio, string> = {
  "3:2": "aspect-[3/2]",
  "4:3": "aspect-[4/3]",
  "1:1": "aspect-square",
  fill: "h-full w-full",
};

const GROUNDS = ["bg-photo-sand", "bg-photo-sage", "bg-photo-slate", "bg-photo-clay"] as const;

export function photoGround(index: number): string {
  return GROUNDS[Math.abs(index) % GROUNDS.length]!;
}

/**
 * Fixed-ratio photo frame: radius-lg, 1px line outline, object-fit cover.
 * While loading or missing: one of four grounds (rotated by index) carrying the
 * place name bottom-left. Caption sits inside the frame bottom-left on a
 * slightly darker ground. Never a broken-image glyph, never an overlay.
 */
export function PhotoFrame({
  src,
  alt,
  ratio = "3:2",
  index = 0,
  caption,
  placeholderLabel,
  className,
  imgClassName,
  sizes,
}: {
  src?: string | null;
  alt: string;
  ratio?: PhotoRatio;
  index?: number;
  /** Shown inside the frame, bottom-left (e.g. place name or Google author attribution). */
  caption?: string | null;
  /** Text shown on the ground when there is no photo; defaults to `caption` then `alt`. */
  placeholderLabel?: string | null;
  className?: string;
  imgClassName?: string;
  sizes?: string;
}) {
  const label = caption ?? null;
  const fallbackLabel = placeholderLabel ?? caption ?? alt;
  return (
    <figure
      className={cn(
        "border-line relative isolate overflow-hidden rounded-lg border",
        RATIO[ratio],
        photoGround(index),
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          sizes={sizes}
          loading="lazy"
          decoding="async"
          className={cn("absolute inset-0 size-full object-cover object-center", imgClassName)}
        />
      ) : null}
      {(src ? label : fallbackLabel) ? (
        <figcaption
          className={cn(
            "text-caption text-ink-secondary absolute bottom-0 left-0 max-w-full truncate px-4 py-3",
            src && "bg-surface-raised/85 rounded-tr-md",
          )}
        >
          {src ? label : fallbackLabel}
        </figcaption>
      ) : null}
    </figure>
  );
}
