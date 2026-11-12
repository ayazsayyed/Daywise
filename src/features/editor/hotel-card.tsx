"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowLeftRight, BedDouble, Search } from "lucide-react";

import { PhotoFrame, SectionLabel, VerifiedBadge, VerifyBadge } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MEAL_PLANS } from "@/lib/ai/schemas";
import { formatWeekdayDate } from "@/lib/format";
import type { EditorDay, EditorHotel, EditorOp } from "@/lib/itinerary/doc";
import { cn } from "@/lib/utils";

import { searchHotels, type HotelResult } from "./actions";
import { InlineText, InlineTime } from "./inline";

export const MEAL_LABEL: Record<(typeof MEAL_PLANS)[number], string> = {
  EP: "EP · room only",
  CP: "CP · breakfast",
  MAP: "MAP · breakfast and dinner",
  AP: "AP · all meals",
};

/**
 * Hotel card per night (PNG 11, 19): 4:3 photo, NIGHT n · date, name, address,
 * room and meal plan, check-in/out, Verified or "Verify before sending", Swap.
 * Swap turns the card into an inline Places search (PNG 12/13).
 */
export function HotelCard({
  day,
  night,
  itineraryId,
  dispatch,
  index,
  disabled,
}: {
  day: EditorDay;
  night: number;
  itineraryId: string;
  dispatch: (op: EditorOp) => void;
  index: number;
  disabled?: boolean;
}) {
  const [swapping, setSwapping] = useState(false);
  const hotel = day.hotel;
  const eyebrow = `Night ${night}${day.date ? ` · ${formatWeekdayDate(day.date)}` : ""}`;

  if (swapping || !hotel) {
    if (!swapping && !hotel) {
      return (
        <div className="border-line bg-surface-sunken flex flex-wrap items-center justify-between gap-4 rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <BedDouble aria-hidden className="text-ink-secondary size-4" />
            <div className="flex flex-col">
              <SectionLabel>{eyebrow}</SectionLabel>
              <span className="text-body-sm text-ink-secondary">No hotel for this night yet.</span>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setSwapping(true)}
            disabled={disabled}
          >
            Add hotel
          </Button>
        </div>
      );
    }
    return (
      <HotelSwap
        day={day}
        eyebrow={eyebrow}
        itineraryId={itineraryId}
        current={hotel}
        onCancel={() => setSwapping(false)}
        onPick={(op) => {
          dispatch(op);
          setSwapping(false);
        }}
      />
    );
  }

  const photoLabel = hotel.name;
  return (
    <div className="border-line bg-surface-sunken grid gap-4 rounded-lg border p-3 sm:grid-cols-[176px_1fr] sm:gap-5">
      <PhotoFrame
        ratio="4:3"
        index={index}
        src={hotel.image?.source === "placeholder" ? null : hotel.image?.url}
        alt={hotel.name}
        caption={
          hotel.image?.credit && hotel.image.source === "place"
            ? `${photoLabel} · ${hotel.image.credit}`
            : photoLabel
        }
        placeholderLabel={photoLabel}
        className="w-full"
      />
      <div className="flex min-w-0 flex-col gap-3 py-1 pr-1">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <SectionLabel>{eyebrow}</SectionLabel>
            <h4 className="text-heading-2 text-ink">{hotel.name}</h4>
            {hotel.address && (
              <p className="text-caption text-ink-secondary truncate">{hotel.address}</p>
            )}
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setSwapping(true)}
            disabled={disabled}
            className="hidden sm:inline-flex"
          >
            <ArrowLeftRight aria-hidden /> Swap
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex min-w-0 flex-col">
            <span className="text-caption text-ink-secondary">Room</span>
            <InlineText
              value={hotel.roomType}
              label={`Room type at ${hotel.name}`}
              placeholder="Deluxe double"
              maxLength={80}
              onChange={(v) => dispatch({ op: "hotel.set", dayId: day.id, patch: { roomType: v } })}
              className="text-body-sm text-ink"
            />
          </div>
          <div className="flex min-w-0 flex-col">
            <label className="text-caption text-ink-secondary" htmlFor={`meal-${day.id}`}>
              Meal plan
            </label>
            <select
              id={`meal-${day.id}`}
              value={hotel.mealPlan ?? ""}
              onChange={(e) =>
                dispatch({
                  op: "hotel.set",
                  dayId: day.id,
                  patch: {
                    mealPlan: (e.target.value || null) as (typeof MEAL_PLANS)[number] | null,
                  },
                })
              }
              className="text-body-sm text-ink hover:bg-surface-sunken/70 focus:ring-indigo -mx-1.5 rounded-sm bg-transparent px-1 outline-none focus:ring-2"
            >
              <option value="">Not set</option>
              {MEAL_PLANS.map((m) => (
                <option key={m} value={m}>
                  {MEAL_LABEL[m]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex min-w-0 items-center gap-4">
            <span className="text-caption text-ink-secondary">Check-in</span>
            <InlineTime
              value={hotel.checkIn}
              label="Check-in time"
              onChange={(v) => dispatch({ op: "hotel.set", dayId: day.id, patch: { checkIn: v } })}
              className="text-ink"
            />
          </div>
          <div className="flex min-w-0 items-center gap-4">
            <span className="text-caption text-ink-secondary">Check-out</span>
            <InlineTime
              value={hotel.checkOut}
              label="Check-out time"
              onChange={(v) => dispatch({ op: "hotel.set", dayId: day.id, patch: { checkOut: v } })}
              className="text-ink"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          {hotel.verified ? <VerifiedBadge /> : <VerifyBadge />}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setSwapping(true)}
            disabled={disabled}
            className="sm:hidden"
          >
            <ArrowLeftRight aria-hidden /> Swap hotel
          </Button>
        </div>
      </div>
    </div>
  );
}

function HotelSwap({
  day,
  eyebrow,
  itineraryId,
  current,
  onCancel,
  onPick,
}: {
  day: EditorDay;
  eyebrow: string;
  itineraryId: string;
  current: EditorHotel | null;
  onCancel: () => void;
  onPick: (op: EditorOp) => void;
}) {
  const [query, setQuery] = useState(day.city);
  const [results, setResults] = useState<HotelResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const [manual, setManual] = useState(false);
  /** True from the first keystroke until the answer for the latest query arrives. */
  const [waiting, setWaiting] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const seq = useRef(0);

  useEffect(() => input.current?.focus(), []);

  // Search after a short pause (each new query is one cached Places call).
  useEffect(() => {
    const q = query.trim();
    if (q.length < 3 || manual) {
      setWaiting(false);
      return;
    }
    const n = ++seq.current;
    setWaiting(true);
    const t = setTimeout(() => {
      start(async () => {
        const res = await searchHotels(itineraryId, q, day.city).catch(() => ({
          results: [],
          error: "Search failed. Try again or enter the hotel manually.",
        }));
        if (n !== seq.current) return;
        setResults(res.results);
        setError(res.error ?? null);
        setActive(0);
        setWaiting(false);
      });
    }, 450);
    return () => clearTimeout(t);
  }, [query, itineraryId, day.city, manual]);

  const choose = (r: HotelResult) =>
    onPick({
      op: "hotel.replace",
      dayId: day.id,
      hotelId: crypto.randomUUID(),
      placeId: r.placeId,
      preview: { name: r.name, address: r.address, image: r.image },
    });

  return (
    <div className="border-line bg-surface-sunken flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex items-start justify-between gap-3 px-1 pt-1">
        <div className="flex flex-col gap-1">
          <SectionLabel>{`${eyebrow} · ${current ? "Swap hotel" : "Add hotel"}`}</SectionLabel>
          {current && (
            <p className="text-caption text-ink-secondary flex flex-wrap items-center gap-2">
              Replacing {current.name}
              {!current.verified && <VerifyBadge />}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="focus-ring text-body-sm text-ink rounded-sm font-medium"
        >
          Cancel
        </button>
      </div>

      {!manual ? (
        <>
          <div className="relative">
            <Search
              aria-hidden
              className="text-ink-secondary pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            />
            <Input
              ref={input}
              value={query}
              aria-label="Search hotels on Google Places"
              role="combobox"
              aria-expanded={results.length > 0}
              aria-controls={`swap-${day.id}`}
              aria-activedescendant={results[active] ? `swap-${day.id}-${active}` : undefined}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive((a) => Math.min(results.length - 1, a + 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((a) => Math.max(0, a - 1));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  if (results[active]) choose(results[active]);
                } else if (e.key === "Escape") onCancel();
              }}
              className="border-indigo pl-9"
            />
          </div>
          <div className="border-line bg-surface-raised shadow-float overflow-hidden rounded-md border">
            <ul id={`swap-${day.id}`} role="listbox" aria-label="Hotels" className="p-1">
              {results.map((r, i) => (
                <li
                  key={r.placeId}
                  id={`swap-${day.id}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(r)}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-[5px] p-2",
                    i === active && "bg-surface-sunken",
                  )}
                >
                  <PhotoFrame
                    ratio="1:1"
                    index={i}
                    src={r.image?.url}
                    alt=""
                    className="size-10 shrink-0 rounded-md"
                    placeholderLabel=""
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="text-body-sm text-ink truncate font-semibold">{r.name}</span>
                    <span className="text-caption text-ink-secondary truncate">{r.address}</span>
                  </span>
                </li>
              ))}
              {results.length === 0 && (
                <li className="text-body-sm text-ink-secondary p-3">
                  {pending || waiting
                    ? "Searching…"
                    : (error ??
                      (query.trim().length < 3
                        ? "Type a hotel name or area."
                        : "No hotels found."))}
                </li>
              )}
            </ul>
            <div className="border-line text-caption text-ink-muted flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2">
              <span className="hidden sm:inline">
                ↑ ↓ to move · Enter to choose · Results from Google Places
              </span>
              <button
                type="button"
                onClick={() => {
                  setManual(true);
                  setName(query.trim() === day.city ? "" : query.trim());
                }}
                className="focus-ring text-ink rounded-sm font-medium"
              >
                Enter manually
              </button>
            </div>
          </div>
        </>
      ) : (
        <form
          className="bg-surface-raised border-line flex flex-col gap-3 rounded-md border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim().length < 2) return;
            onPick({
              op: "hotel.replace",
              dayId: day.id,
              hotelId: crypto.randomUUID(),
              manual: { name: name.trim(), address: address.trim() },
            });
          }}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor={`mh-name-${day.id}`}>Hotel name</Label>
            <Input
              id={`mh-name-${day.id}`}
              autoFocus
              value={name}
              maxLength={120}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`mh-addr-${day.id}`}>Address</Label>
            <Input
              id={`mh-addr-${day.id}`}
              value={address}
              maxLength={240}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
          <p className="text-caption text-ink-muted">
            Manual hotels are marked “Verify before sending”.
          </p>
          <div className="flex gap-2">
            <Button type="submit" variant="secondary" size="sm" disabled={name.trim().length < 2}>
              Use this hotel
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setManual(false)}>
              Back to search
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
