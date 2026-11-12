"use client";

import { ChevronDown, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import { WhatsAppButton } from "./parts";

/**
 * Interactive parts of the client page (PNG 24, 25, 29): the 44px sticky day
 * index with its Overview sheet and the sticky bottom bar on phones and
 * tablets, and the sticky "Your five days" list on wide desktops. Scrolling
 * and opening the sheet are never tracked (deviation 7).
 */

export type NavDay = { n: number; anchor: string; city: string; nightLine: string; date: string };

/** The day whose section is under the sticky index right now (1-based; 0 = before day 1). */
function useCurrentDay(count: number): number {
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-day]"));
    if (!els.length) return;
    const onScroll = () => {
      const line = 120;
      let cur = 0;
      for (const el of els)
        if (el.getBoundingClientRect().top <= line) cur = Number(el.dataset.day);
      const end = document.getElementById("price-and-terms");
      if (end && end.getBoundingClientRect().top <= line) cur = count + 1;
      setCurrent(cur);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [count]);
  return current;
}

function go(anchor: string) {
  const el = document.getElementById(anchor);
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY - 52;
  window.scrollTo({ top, behavior: "smooth" });
}

export function MobileNav({
  days,
  countWord,
  dateLine,
  hasPrice,
  agencyName,
  bar,
  whatsappHref,
}: {
  days: NavDay[];
  countWord: string;
  dateLine: string;
  hasPrice: boolean;
  agencyName: string;
  bar: { amount: string; line: string } | null;
  whatsappHref: string | null;
}) {
  const current = useCurrentDay(days.length);
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const cur = days.find((d) => d.n === current) ?? null;

  const close = useCallback(() => setOpen(false), []);
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close]);

  const pick = (anchor: string) => {
    setOpen(false);
    requestAnimationFrame(() => go(anchor));
  };

  return (
    <>
      {/* 44px sticky index (< 1100px; deviation 6) */}
      <nav
        aria-label="Days"
        data-noprint
        className="bg-paper/95 border-line sticky top-0 z-30 -mx-5 border-b px-5 backdrop-blur-sm min-[1100px]:hidden md:-mx-8 md:px-8"
      >
        <div className="flex h-11 items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={open}
            className="text-ink flex min-w-0 items-center gap-1.5 text-[15px] font-medium"
          >
            <span className="truncate">
              {cur
                ? `Day ${cur.n} · ${cur.city}`
                : current > days.length
                  ? "Price and terms"
                  : `Your ${countWord} days`}
            </span>
            <ChevronDown className="text-ink-muted size-4 shrink-0" aria-hidden />
          </button>
          <ol className="flex shrink-0 items-center gap-0.5">
            {days.map((d) => (
              <li key={d.n}>
                <button
                  type="button"
                  onClick={() => go(d.anchor)}
                  aria-label={`Day ${d.n}`}
                  aria-current={d.n === current ? "step" : undefined}
                  className={cn(
                    "tnum grid size-8 place-items-center rounded-md text-[14px]",
                    d.n === current
                      ? "bg-surface-sunken text-tenant font-semibold"
                      : "text-ink-muted",
                  )}
                >
                  {d.n}
                </button>
              </li>
            ))}
          </ol>
        </div>
      </nav>

      {/* Overview sheet (PNG 25) */}
      {open ? (
        <div
          className="fixed inset-0 z-50 min-[1100px]:hidden"
          role="dialog"
          aria-modal
          aria-label="Overview"
        >
          <button
            type="button"
            aria-label="Close overview"
            className="bg-scrim absolute inset-0 h-full w-full"
            onClick={close}
          />
          <div className="bg-surface-raised shadow-float absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-lg pb-[env(safe-area-inset-bottom)]">
            <div className="bg-line mx-auto mt-2 h-1 w-9 rounded-full" aria-hidden />
            <div className="flex items-start justify-between px-6 pt-4 pb-4">
              <div>
                <h2 className="text-ink text-[18px] leading-6 font-semibold">
                  Your {countWord} days
                </h2>
                <p className="text-ink-muted text-[13px] leading-5">{dateLine}</p>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={close}
                aria-label="Close"
                className="text-ink-secondary -mr-2 grid size-9 place-items-center rounded-md"
              >
                <X className="size-4" />
              </button>
            </div>
            <ul className="px-[18px] pb-4">
              {days.map((d) => (
                <li key={d.n} className="border-line border-t first:border-t">
                  <button
                    type="button"
                    onClick={() => pick(d.anchor)}
                    className={cn(
                      "grid w-full grid-cols-[40px_1fr_auto] gap-x-2 rounded-md px-1.5 py-3 text-left",
                      d.n === current && "bg-surface-sunken",
                    )}
                  >
                    <span
                      className={cn(
                        "tnum text-[20px] leading-6 font-medium",
                        d.n === current ? "text-tenant" : "text-ink-muted",
                      )}
                    >
                      {d.n}
                    </span>
                    <span className="min-w-0">
                      <span className="text-ink block text-[16px] leading-6 font-semibold">
                        {d.city}
                      </span>
                      <span className="text-ink-secondary block truncate text-[14px] leading-5">
                        {d.nightLine}
                      </span>
                    </span>
                    <span className="text-ink-muted text-[13px] leading-6 whitespace-nowrap">
                      {d.date}
                    </span>
                  </button>
                </li>
              ))}
              <li className="border-line border-t">
                <button
                  type="button"
                  onClick={() => pick("price-and-terms")}
                  className="text-ink w-full py-3.5 pl-[54px] text-left text-[16px]"
                >
                  {hasPrice ? "Price, inclusions and terms" : "Inclusions and terms"}
                </button>
              </li>
              <li className="border-line border-t">
                <button
                  type="button"
                  onClick={() => pick("contact")}
                  className="text-ink w-full py-3.5 pl-[54px] text-left text-[16px]"
                >
                  Contact {agencyName}
                </button>
              </li>
            </ul>
          </div>
        </div>
      ) : null}

      {/* Sticky bottom bar (phones; hidden while the sheet is open) */}
      {!open ? (
        <div
          data-noprint
          className="bg-surface-raised border-line fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] md:hidden"
        >
          <div className="flex h-16 items-center justify-between gap-3 px-5">
            {bar ? (
              <div className="min-w-0">
                <div className="tnum text-ink text-[20px] leading-6 font-semibold">
                  {bar.amount}
                </div>
                <div className="text-ink-muted truncate text-[13px] leading-4">{bar.line}</div>
              </div>
            ) : (
              <div className="min-w-0">
                <div className="text-ink text-[16px] leading-6 font-semibold">Ask for price</div>
                <div className="text-ink-muted truncate text-[13px] leading-4">
                  Quoted on WhatsApp
                </div>
              </div>
            )}
            <WhatsAppButton href={whatsappHref} label="WhatsApp" size="lg" className="shrink-0" />
          </div>
        </div>
      ) : null}
    </>
  );
}

/** Desktop ≥ 1100px: sticky left list (PNG 29); never covers content (deviation 6). */
export function DesktopIndex({
  days,
  countWord,
  hasPrice,
}: {
  days: NavDay[];
  countWord: string;
  hasPrice: boolean;
}) {
  const current = useCurrentDay(days.length);
  return (
    <nav
      aria-label="Days"
      data-noprint
      className="sticky top-8 hidden self-start min-[1100px]:block"
    >
      <h2 className="text-label text-ink-muted border-line border-b pb-3">Your {countWord} days</h2>
      <ol>
        {days.map((d) => (
          <li key={d.n} className="border-line border-b">
            <a
              href={`#${d.anchor}`}
              onClick={(e) => {
                e.preventDefault();
                go(d.anchor);
              }}
              aria-current={d.n === current ? "step" : undefined}
              className="grid grid-cols-[28px_1fr] py-3"
            >
              <span
                className={cn(
                  "tnum text-[13px] leading-5",
                  d.n === current ? "text-tenant font-semibold" : "text-ink-muted",
                )}
              >
                {d.n}
              </span>
              <span className="min-w-0">
                <span
                  className={cn(
                    "block truncate text-[13px] leading-5",
                    d.n === current ? "text-ink font-semibold" : "text-ink font-medium",
                  )}
                >
                  {d.city}
                </span>
                <span className="text-ink-muted block truncate text-[12px] leading-4">
                  {d.nightLine}
                </span>
              </span>
            </a>
          </li>
        ))}
        <li className="border-line border-b">
          <a
            href="#price-and-terms"
            onClick={(e) => {
              e.preventDefault();
              go("price-and-terms");
            }}
            className={cn(
              "block py-3 pl-7 text-[13px]",
              current > days.length ? "text-ink font-semibold" : "text-ink",
            )}
          >
            {hasPrice ? "Price and terms" : "Inclusions and terms"}
          </a>
        </li>
        <li className="border-line border-b">
          <a
            href="#contact"
            onClick={(e) => {
              e.preventDefault();
              go("contact");
            }}
            className="text-ink block py-3 pl-7 text-[13px]"
          >
            Contact
          </a>
        </li>
      </ol>
    </nav>
  );
}

/** "Try again" on the unavailable state. */
export function RetryButton() {
  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      className="border-line-strong text-ink bg-surface-raised inline-flex h-12 w-full items-center justify-center gap-2 rounded-md border text-[16px] font-medium"
    >
      <RotateIcon />
      Try again
    </button>
  );
}

function RotateIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path
        d="M21 12a9 9 0 0 1-15.5 6.2M3 12A9 9 0 0 1 18.5 5.8M21 4v5h-5M3 20v-5h5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
