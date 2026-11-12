import { BedDouble, MessageCircle } from "lucide-react";

import { cn } from "@/lib/utils";

import type { ShareAgency, ShareImage } from "./view";

/**
 * Small building blocks shared by the client page, its states and the print
 * layout. Tenant colour arrives as `--tenant-accent` on the page root and is
 * used only where DESIGN.md Part 2 allows.
 */

const GROUNDS = ["bg-photo-sand", "bg-photo-sage", "bg-photo-slate", "bg-photo-clay"] as const;

export function LogoTile({ agency, size = 32 }: { agency: ShareAgency; size?: number }) {
  if (agency.logoUrl)
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={agency.logoUrl}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-md object-contain"
        style={{ width: size, height: size }}
      />
    );
  return (
    <span
      aria-hidden
      className="bg-tenant text-on-tenant grid shrink-0 place-items-center rounded-md text-[13px] font-semibold"
      style={{ width: size, height: size }}
    >
      {agency.initials}
    </span>
  );
}

export function Wordmark({ agency, size = 32 }: { agency: ShareAgency; size?: number }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <LogoTile agency={agency} size={size} />
      <div className="min-w-0">
        <div className="text-tenant truncate text-[15px] leading-5 font-semibold">
          {agency.name}
        </div>
        {agency.tagline ? (
          <div className="text-ink-muted truncate text-[12px] leading-4">{agency.tagline}</div>
        ) : null}
      </div>
    </div>
  );
}

/** The only filled shape on the page (Part 2). */
export function WhatsAppButton({
  href,
  label = "Chat on WhatsApp",
  className,
  size = "md",
}: {
  href: string | null;
  label?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      data-noprint
      className={cn(
        "bg-tenant text-on-tenant inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-[filter] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2",
        size === "sm" && "h-9 px-3.5 text-[13px]",
        size === "md" && "h-10 px-4 text-[14px]",
        size === "lg" && "h-12 px-5 text-[16px]",
        className,
      )}
    >
      <MessageCircle className={size === "lg" ? "size-5" : "size-4"} aria-hidden />
      {label}
    </a>
  );
}

/** Fixed-ratio frame; caption once, under the frame (deviation 1), with the Google credit. */
export function Photo({
  image,
  ratio,
  index = 0,
  fallbackLabel,
  className,
  frameClassName,
  sizes,
  eager,
}: {
  image: ShareImage | null;
  ratio: "3:2" | "4:3" | "cover";
  index?: number;
  fallbackLabel: string;
  className?: string;
  frameClassName?: string;
  sizes?: string;
  eager?: boolean;
}) {
  const aspect =
    ratio === "3:2"
      ? "aspect-[3/2]"
      : ratio === "4:3"
        ? "aspect-[4/3]"
        : "aspect-[3/2] md:aspect-[7/3]";
  const real = image && !image.url.startsWith("/placeholder.svg") ? image : null;
  return (
    <figure className={cn("photo", className)}>
      <div
        className={cn(
          "border-line relative overflow-hidden rounded-lg border",
          aspect,
          GROUNDS[Math.abs(index) % GROUNDS.length],
          frameClassName,
        )}
      >
        {real ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={real.url}
            alt={image?.caption ?? fallbackLabel}
            sizes={sizes}
            loading={eager ? "eager" : "lazy"}
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <span className="text-ink-secondary absolute bottom-3 left-3.5 text-[12px] leading-4">
            {image?.caption ?? fallbackLabel}
          </span>
        )}
      </div>
      {real ? (
        <figcaption className="text-ink-muted mt-2 text-[12px] leading-4">
          {real.caption}
          {real.credit ? <span className="text-ink-muted"> · {real.credit}</span> : null}
        </figcaption>
      ) : null}
    </figure>
  );
}

/** Missing hotel photo: sunken frame, small bed icon, the place name. */
export function HotelPhoto({
  image,
  name,
  showCredit = true,
}: {
  image: ShareImage | null;
  name: string;
  showCredit?: boolean;
}) {
  const real = image && !image.url.startsWith("/placeholder.svg") ? image : null;
  return (
    <figure className="photo">
      <div
        className={cn(
          "border-line relative aspect-[4/3] overflow-hidden rounded-md border",
          real ? "bg-photo-clay" : "bg-surface-sunken",
        )}
      >
        {real ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={real.url}
            alt={name}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="text-ink-muted absolute inset-0 grid place-items-center">
            <div className="flex flex-col items-center gap-1.5 px-3 text-center">
              <BedDouble className="size-4" aria-hidden />
              <span className="text-[12px] leading-4">{name}</span>
            </div>
          </div>
        )}
      </div>
      {showCredit && real?.credit ? (
        <figcaption className="text-ink-muted mt-1.5 text-[12px] leading-4">
          {real.credit}
        </figcaption>
      ) : null}
    </figure>
  );
}

export function ContactTable({
  agency,
  linkTone = "accent",
}: {
  agency: ShareAgency;
  linkTone?: "accent" | "ink";
}) {
  if (!agency.contacts.length) return null;
  return (
    <dl className="grid grid-cols-[88px_1fr] gap-x-4 gap-y-2 text-[14px] leading-5">
      {agency.contacts.map((c) => (
        <div key={c.label} className="contents">
          <dt className="text-ink-muted">{c.label}</dt>
          <dd className="min-w-0 break-words">
            {c.href ? (
              <a
                href={c.href}
                target={c.href.startsWith("http") ? "_blank" : undefined}
                rel="noopener noreferrer"
                className={linkTone === "accent" ? "text-tenant hover:underline" : "text-ink"}
              >
                {c.value}
              </a>
            ) : (
              <span className="text-ink">{c.value}</span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** CSS variables for the tenant colour; `on-tenant-accent` is fixed (Part 2). */
export function tenantStyle(accent: string): React.CSSProperties {
  // Set the theme token itself: a var() inside @theme resolves at :root, not here.
  return { ["--tenant-accent" as string]: accent, ["--color-tenant" as string]: accent };
}
