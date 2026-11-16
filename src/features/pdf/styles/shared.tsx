import { LogoTile } from "@/features/share/parts";
import { ContactTable } from "@/features/share/parts";
import { PriceBlock, Sections } from "@/features/share/share-page";
import { cn } from "@/lib/utils";

import type { StyleProps } from "./types";

/** Title size steps so a 60-character trip title still fits (Part 2 "PDF styles"). */
export function titleSizePt(title: string, base: number): number {
  const n = title.length;
  if (n <= 14) return base;
  if (n <= 24) return Math.round(base * 0.78);
  if (n <= 40) return Math.round(base * 0.62);
  return Math.round(base * 0.42);
}

export function titleFamily(font: "inter" | "serif"): string | undefined {
  return font === "serif" ? "var(--font-pdf-serif), Georgia, serif" : undefined;
}

/** Logo tile + agency name (+ tagline), in a given text colour. Truncates long names. */
export function LogoLockup({
  view,
  color,
  secondary,
  size = 34,
  className,
  wrap = false,
}: StyleProps & {
  color: string;
  secondary: string;
  size?: number;
  className?: string;
  wrap?: boolean;
}) {
  const { agency } = view.share;
  return (
    <div className={cn("flex min-w-0 items-center gap-[3mm]", className)}>
      <LogoTile agency={agency} size={size} />
      <div className="min-w-0">
        <div
          className={cn("text-[12pt] leading-tight font-semibold", !wrap && "truncate")}
          style={{ color, maxWidth: wrap ? undefined : "62mm" }}
        >
          {agency.name}
        </div>
        {agency.tagline ? (
          <div
            className="truncate text-[8pt] leading-tight"
            style={{ color: secondary, maxWidth: "62mm" }}
          >
            {agency.tagline}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** The two caption lines every PDF ends with (credits are mandatory). */
export function Captions({ view, color }: StyleProps & { color?: string }) {
  return (
    <div
      className="pdf-captions space-y-[1mm] text-[9pt] leading-[1.35]"
      style={{ color: color ?? "var(--pdf-ink-2)" }}
    >
      <p>
        Hotels are subject to availability at the time of booking · Last updated{" "}
        {view.share.lastUpdated}
      </p>
      {view.credits ? <p>{view.credits}</p> : null}
    </div>
  );
}

/** Quiet terms page used by Editorial (preview), Photo-first and Minimal. */
export function TermsContent({ view, tokens, heading = true }: StyleProps & { heading?: boolean }) {
  const s = view.share;
  return (
    <div className="share-terms flex flex-col gap-[6mm]">
      {heading ? (
        <h2
          className="text-[22pt] leading-tight font-semibold"
          style={{ color: tokens.ink, fontFamily: titleFamily(tokens.titleFont) }}
        >
          {s.price ? "Price and terms" : "Inclusions and terms"}
        </h2>
      ) : null}
      {s.price ? <PriceBlock price={s.price} /> : null}
      <Sections view={s} priced={!!s.price} />
      <ContactBlock view={view} tokens={tokens} />
      <Captions view={view} tokens={tokens} />
    </div>
  );
}

export function ContactBlock({ view, tokens }: StyleProps) {
  const { agency } = view.share;
  return (
    <div
      className="share-footer grid grid-cols-[minmax(0,1fr)_minmax(0,1.7fr)] gap-[8mm] border-t pt-[5mm]"
      style={{ borderColor: tokens.accentOnPaper }}
    >
      <div className="min-w-0">
        <LogoLockup
          view={view}
          tokens={tokens}
          color={tokens.ink}
          secondary={tokens.inkSecondary}
          size={30}
          wrap
        />
        {agency.footer ? (
          <p className="mt-[3mm] text-[10pt] leading-[1.45]" style={{ color: tokens.inkSecondary }}>
            {agency.footer}
          </p>
        ) : null}
      </div>
      <div className="share-contacts min-w-0 text-[10pt]">
        <ContactTable agency={agency} />
      </div>
    </div>
  );
}

/**
 * Body flow: repeating table header/footer spacers hold the content inside
 * the style's insets on every page (the page margin is 0 so the chrome can
 * bleed). Proven in the stationery spike: forced day breaks and unsplit
 * hotel cards both hold.
 */
export function Flow({
  insets,
  children,
}: {
  insets: { top: number; right: number; bottom: number; left: number };
  children: React.ReactNode;
}) {
  return (
    <table className="pdf-flow w-full border-collapse">
      <thead>
        <tr>
          <td style={{ height: `${insets.top}mm`, padding: 0 }} />
        </tr>
      </thead>
      <tfoot>
        <tr>
          <td style={{ height: `${insets.bottom}mm`, padding: 0 }} />
        </tr>
      </tfoot>
      <tbody>
        <tr>
          <td style={{ padding: `0 ${insets.right}mm 0 ${insets.left}mm`, verticalAlign: "top" }}>
            {children}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

/** Thin line icons (lucide geometry, drawn here so they print crisply at any size). */
export function LineIcon({
  name,
  color,
  size = "6mm",
}: {
  name: "calendar" | "bed" | "people" | "check" | "cross" | "card" | "clock";
  color: string;
  size?: string;
}) {
  const p = {
    calendar:
      "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
    bed: "M2 4v16M2 8h18a2 2 0 0 1 2 2v10M2 17h20M6 8v9",
    people:
      "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
    check: "M20 6 9 17l-5-5",
    cross: "M18 6 6 18M6 6l12 12",
    card: "M2 7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2zM2 10h20",
    clock: "M12 6v6l4 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z",
  }[name];
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="shrink-0"
    >
      <path d={p} />
    </svg>
  );
}
