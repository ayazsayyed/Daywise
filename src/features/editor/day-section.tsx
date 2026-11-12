"use client";

import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  GripVertical,
  LoaderCircle,
  MoreHorizontal,
  Navigation,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";

import { Menu, PhotoFrame, SectionLabel } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatWeekdayDate } from "@/lib/format";
import type { EditorDay, EditorOp, EditorStop } from "@/lib/itinerary/doc";
import { cn } from "@/lib/utils";

import { HotelCard } from "./hotel-card";
import { InlineText, InlineTime } from "./inline";

export type DayActions = {
  onRegenerate: () => void;
  onMove: (dir: -1 | 1) => void;
  onAddAfter: () => void;
  onDelete: () => void;
  onToggle: () => void;
};

export function DaySection({
  day,
  index,
  total,
  itineraryId,
  dispatch,
  collapsed,
  regenerating,
  regenError,
  actions,
}: {
  day: EditorDay;
  index: number;
  total: number;
  itineraryId: string;
  dispatch: (op: EditorOp) => void;
  collapsed: boolean;
  regenerating: string | null;
  regenError: string | null;
  actions: DayActions;
}) {
  const isLast = index === total - 1;
  const dateLabel = day.date ? formatWeekdayDate(day.date) : null;
  const busy = regenerating !== null;

  const menu = (
    <Menu
      label={`More for day ${index + 1}`}
      trigger={(p) => (
        <button
          type="button"
          {...p}
          className="focus-ring text-ink-secondary hover:text-ink hover:bg-surface-sunken grid size-8 place-items-center rounded-md"
        >
          <MoreHorizontal aria-hidden className="size-4" />
        </button>
      )}
      items={[
        {
          label: "Move day up",
          icon: <ArrowUp />,
          onSelect: () => actions.onMove(-1),
          disabled: index === 0,
        },
        {
          label: "Move day down",
          icon: <ArrowDown />,
          onSelect: () => actions.onMove(1),
          disabled: isLast,
        },
        { label: "Add a day after", icon: <Plus />, onSelect: actions.onAddAfter },
        {
          label: collapsed ? "Expand" : "Collapse",
          icon: collapsed ? <ChevronDown /> : <ChevronUp />,
          onSelect: actions.onToggle,
        },
        "separator",
        {
          label: "Delete day",
          icon: <Trash2 />,
          onSelect: actions.onDelete,
          danger: true,
          disabled: total <= 1,
        },
      ]}
    />
  );

  const label = (
    <div className="flex flex-col gap-0.5 lg:pt-1.5">
      <SectionLabel>Day {index + 1}</SectionLabel>
      {dateLabel && <span className="text-heading-3 text-ink">{dateLabel}</span>}
      <span className="text-caption text-ink-muted">{day.city}</span>
    </div>
  );

  if (collapsed) {
    const thumb = day.hero;
    return (
      <section
        id={`day-${day.id}`}
        aria-label={`Day ${index + 1}: ${day.title}`}
        className="border-line grid scroll-mt-28 gap-x-8 border-b py-4 lg:grid-cols-[112px_1fr]"
      >
        <div className="hidden lg:block">{label}</div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={actions.onToggle}
            aria-expanded={false}
            className="focus-ring flex min-w-0 flex-1 items-center gap-4 rounded-md text-left"
          >
            <PhotoFrame
              ratio="3:2"
              index={index}
              src={thumb?.source === "placeholder" ? null : thumb?.url}
              alt=""
              placeholderLabel=""
              className="w-[72px] shrink-0 rounded-md"
            />
            <span className="flex min-w-0 flex-col">
              <span className="text-caption text-ink-muted lg:hidden">
                Day {index + 1}
                {dateLabel ? ` · ${dateLabel}` : ""}
              </span>
              <span className="text-heading-3 text-ink truncate">{day.title}</span>
              <span className="text-caption text-ink-secondary truncate">
                {day.stops.length} {day.stops.length === 1 ? "stop" : "stops"} ·{" "}
                {day.hotel ? (
                  <>
                    {day.hotel.name} ·{" "}
                    <span className={day.hotel.verified ? "text-green" : "text-amber"}>
                      {day.hotel.verified ? "Verified" : "Verify before sending"}
                    </span>
                  </>
                ) : isLast ? (
                  "No hotel"
                ) : (
                  "No hotel yet"
                )}
              </span>
            </span>
            <ChevronDown aria-hidden className="text-ink-secondary ml-auto size-4 shrink-0" />
          </button>
          {menu}
        </div>
      </section>
    );
  }

  return (
    <section
      id={`day-${day.id}`}
      aria-label={`Day ${index + 1}: ${day.title}`}
      aria-busy={busy}
      className="border-line grid scroll-mt-28 gap-x-8 border-b py-8 lg:grid-cols-[112px_1fr] lg:py-10"
    >
      <div className="hidden lg:block">
        <div className="sticky top-32">{label}</div>
      </div>

      <div className={cn("flex min-w-0 flex-col gap-5", busy && "pointer-events-none opacity-60")}>
        <div className="flex items-center justify-between gap-3 lg:hidden">
          <SectionLabel>
            Day {index + 1}
            {dateLabel ? ` · ${dateLabel}` : ""}
          </SectionLabel>
          {menu}
        </div>

        <div className="flex items-start gap-3">
          <InlineText
            multiline
            value={day.title}
            label={`Day ${index + 1} title`}
            maxLength={120}
            onChange={(v) => dispatch({ op: "day.set", dayId: day.id, patch: { title: v } })}
            className="text-heading-1 text-ink flex-1"
          />
          <div className="hidden shrink-0 items-center gap-1 pt-0.5 lg:flex">
            <Button variant="ghost" size="sm" onClick={actions.onRegenerate} disabled={busy}>
              {busy ? (
                <LoaderCircle aria-hidden className="animate-spin" />
              ) : (
                <RefreshCw aria-hidden />
              )}
              {busy ? "Regenerating…" : "Regenerate this day"}
            </Button>
            {menu}
          </div>
        </div>

        {regenError && (
          <p className="text-body-sm text-danger" role="alert">
            {regenError}
          </p>
        )}

        <PhotoFrame
          ratio="3:2"
          index={index}
          src={day.hero?.source === "placeholder" ? null : day.hero?.url}
          alt={`${day.city}`}
          caption={heroCaption(day)}
          placeholderLabel={day.stops.find((s) => s.placeId)?.title ?? day.city}
          className="w-full"
          sizes="(min-width: 1024px) 640px, 100vw"
        />

        <InlineText
          multiline
          value={day.summary}
          label={`Day ${index + 1} summary`}
          placeholder="One or two lines about the day"
          maxLength={600}
          onChange={(v) => dispatch({ op: "day.set", dayId: day.id, patch: { summary: v } })}
          className="text-body text-ink-secondary"
        />

        <div className="text-body-sm text-ink-secondary flex items-start gap-2">
          <Navigation aria-hidden className="mt-1 size-3.5 shrink-0" />
          <InlineText
            multiline
            value={day.transport}
            label={`Day ${index + 1} transport`}
            placeholder="Private car · Srinagar → Gulmarg · 2 h"
            maxLength={240}
            onChange={(v) => dispatch({ op: "day.set", dayId: day.id, patch: { transport: v } })}
            className="text-body-sm text-ink-secondary"
          />
        </div>

        <StopList day={day} dispatch={dispatch} />

        {isLast && !day.hotel ? (
          <p className="text-body-sm text-ink-muted">Departure day · no hotel</p>
        ) : (
          <HotelCard
            day={day}
            night={index + 1}
            itineraryId={itineraryId}
            dispatch={dispatch}
            index={index + 1}
            disabled={busy}
          />
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={actions.onRegenerate}
          disabled={busy}
          className="w-fit lg:hidden"
        >
          {busy ? <LoaderCircle aria-hidden className="animate-spin" /> : <RefreshCw aria-hidden />}
          {busy ? "Regenerating…" : "Regenerate this day"}
        </Button>
      </div>
    </section>
  );
}

function heroCaption(day: EditorDay): string {
  const from = day.stops.find((s) => s.image?.ref && s.image.ref === day.hero?.ref);
  const place = from ? `${from.title}, ${day.city}` : day.city;
  return day.hero?.credit ? `${place} · ${day.hero.credit}` : place;
}

function StopList({ day, dispatch }: { day: EditorDay; dispatch: (op: EditorOp) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${day.id}`, data: { dayId: day.id } });
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");

  const add = () => {
    const t = title.trim();
    if (t.length >= 2)
      dispatch({
        op: "stop.add",
        stopId: crypto.randomUUID(),
        dayId: day.id,
        index: day.stops.length,
        title: t,
        kind: "sight",
      });
    setTitle("");
    setAdding(false);
  };

  return (
    <div className="flex flex-col">
      <SortableContext items={day.stops.map((s) => s.id)} strategy={verticalListSortingStrategy}>
        <ol
          ref={setNodeRef}
          aria-label="Stops"
          className={cn(
            "border-line flex min-h-12 flex-col border-t",
            isOver && day.stops.length === 0 && "bg-indigo-soft",
          )}
        >
          {day.stops.map((s, i) => (
            <StopRow
              key={s.id}
              stop={s}
              position={i + 1}
              count={day.stops.length}
              dispatch={dispatch}
            />
          ))}
          {day.stops.length === 0 && (
            <li className="text-body-sm text-ink-muted py-3">
              No stops. Drag one here or add one.
            </li>
          )}
        </ol>
      </SortableContext>
      {adding ? (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <Input
            autoFocus
            value={title}
            maxLength={160}
            aria-label="New stop"
            placeholder="Shikara ride on Dal Lake"
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setAdding(false)}
          />
          <Button type="submit" variant="secondary" disabled={title.trim().length < 2}>
            Add
          </Button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="focus-ring text-body-sm text-ink mt-2 flex w-fit items-center gap-2 rounded-sm py-2 font-medium"
        >
          <Plus aria-hidden className="size-4" /> Add stop
        </button>
      )}
    </div>
  );
}

function StopRow({
  stop,
  position,
  count,
  dispatch,
}: {
  stop: EditorStop;
  position: number;
  count: number;
  dispatch: (op: EditorOp) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stop.id, data: { type: "stop" } });
  const style = { transform: CSS.Translate.toString(transform), transition };

  if (isDragging) {
    return (
      <li
        ref={setNodeRef}
        style={style}
        className="border-indigo bg-indigo-soft text-caption text-indigo my-1 flex h-14 items-center rounded-md border border-dashed px-3"
      >
        Drop here · position {position} of {count}
      </li>
    );
  }

  return (
    <li ref={setNodeRef} style={style} className="border-line group relative border-b">
      <StopContent
        stop={stop}
        dispatch={dispatch}
        handle={
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label={`Drag ${stop.title || "stop"}`}
            className="focus-ring text-ink-muted hover:text-ink grid h-7 w-5 cursor-grab touch-none place-items-center rounded-sm lg:opacity-0 lg:group-focus-within:opacity-100 lg:group-hover:opacity-100"
          >
            <GripVertical aria-hidden className="size-4" />
          </button>
        }
      />
    </li>
  );
}

/** Stop row body; also used (static) inside the drag overlay. */
export function StopContent({
  stop,
  dispatch,
  handle,
}: {
  stop: EditorStop;
  dispatch?: (op: EditorOp) => void;
  handle?: React.ReactNode;
}) {
  const set = (patch: Extract<EditorOp, { op: "stop.set" }>["patch"]) =>
    dispatch?.({ op: "stop.set", stopId: stop.id, patch });
  return (
    <div className="grid grid-cols-[20px_1fr_auto] gap-x-2 py-3 sm:grid-cols-[20px_88px_1fr_auto] sm:gap-x-3">
      <div className="col-start-1 row-span-2 row-start-1 pt-0.5 sm:row-span-1">{handle}</div>
      <div className="col-start-2 row-start-1 pt-1">
        <InlineTime
          value={stop.time}
          label={`Time for ${stop.title}`}
          onChange={(v) => set({ time: v })}
        />
      </div>
      <div className="col-start-2 row-start-2 flex min-w-0 flex-col gap-0.5 sm:col-start-3 sm:row-start-1">
        <InlineText
          value={stop.title}
          label="Stop title"
          maxLength={160}
          onChange={(v) => set({ title: v })}
          className="text-heading-3 text-ink"
        />
        <InlineText
          multiline
          value={stop.description}
          label={`Description for ${stop.title}`}
          placeholder="Add a line for the client"
          maxLength={800}
          onChange={(v) => set({ description: v })}
          className="text-body-sm text-ink-secondary"
        />
      </div>
      <div className="col-start-3 row-start-1 flex items-start gap-1 sm:col-start-4">
        <InlineText
          value={stop.duration ?? ""}
          label={`Duration for ${stop.title}`}
          placeholder="—"
          maxLength={30}
          onChange={(v) => set({ duration: v || null })}
          className="text-caption text-ink-muted w-16 pt-1 text-right"
        />
        {dispatch && (
          <button
            type="button"
            aria-label={`Remove ${stop.title || "stop"}`}
            onClick={() => dispatch({ op: "stop.remove", stopId: stop.id })}
            className="focus-ring text-ink-muted hover:text-danger grid size-7 place-items-center rounded-sm lg:opacity-0 lg:group-focus-within:opacity-100 lg:group-hover:opacity-100"
          >
            <X aria-hidden className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}
