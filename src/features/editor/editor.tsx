"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronDown,
  ChevronLeft,
  Copy,
  Eye,
  LayoutTemplate,
  MoreHorizontal,
  Plus,
  Trash2,
} from "lucide-react";

import {
  Dialog,
  Menu,
  NeutralBadge,
  SaveState,
  SectionLabel,
  SegmentedControl,
  StatusDot,
} from "@/components/ds";
import { Button } from "@/components/ui/button";
import { startFromTemplate } from "@/features/itinerary/actions";
import { formatWeekdayRange } from "@/lib/format";
import {
  applyOp,
  ITINERARY_STATUSES,
  type EditorDoc,
  type EditorSections,
  type EditorStop,
} from "@/lib/itinerary/doc";
import { cn } from "@/lib/utils";

import {
  deleteItinerary,
  duplicateItinerary,
  getDayJob,
  regenerateDay,
  saveAsTemplate,
} from "./actions";
import { openShare } from "@/features/share/actions";
import { SharePanel } from "@/features/share/share-panel";

import { DaySection, StopContent } from "./day-section";
import { InlineText } from "./inline";
import { SidePanel } from "./side-panel";
import { useEditor, type SaveStatus } from "./use-editor";

const STATUS_WORD = { draft: "Draft", sent: "Sent", confirmed: "Confirmed", lost: "Lost" } as const;
const BUDGET_WORD: Record<string, string> = {
  budget: "Budget",
  "mid-range": "Mid-range",
  premium: "Premium",
  luxury: "Luxury",
};

export function Editor({
  initial,
  defaults,
  agencyName,
}: {
  initial: EditorDoc;
  defaults: EditorSections;
  agencyName: string;
}) {
  const { doc, status, dispatch, flush, replaceDay, preview, retry } = useEditor(initial);
  const [tab, setTab] = useState<"days" | "details">("days");
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [regen, setRegen] = useState<Record<string, string>>({});
  const [regenErr, setRegenErr] = useState<Record<string, string>>({});
  const [confirmDay, setConfirmDay] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [pendingNav, startNav] = useTransition();

  const docRef = useRef(doc);
  docRef.current = doc;

  // ── Regenerate day: queue, then poll the job until the new day is back ──
  const onRegenerate = async (dayId: string) => {
    setRegenErr((e) => ({ ...e, [dayId]: "" }));
    await flush();
    const res = await regenerateDay(doc.id, dayId);
    if ("error" in res) setRegenErr((e) => ({ ...e, [dayId]: res.error }));
    else setRegen((r) => ({ ...r, [dayId]: res.jobId }));
  };
  useEffect(() => {
    const entries = Object.entries(regen);
    if (!entries.length) return;
    const t = setInterval(async () => {
      for (const [dayId, jobId] of entries) {
        const res = await getDayJob(jobId).catch(() => null);
        if (!res || res.status === "running") continue;
        setRegen(({ [dayId]: _done, ...rest }) => rest);
        if (res.status === "done") replaceDay(res.day);
        else setRegenErr((e) => ({ ...e, [dayId]: res.error }));
      }
    }, 1_500);
    return () => clearInterval(t);
  }, [regen, replaceDay]);

  // ── Stop drag across days (PNG 12) ──
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const [activeStop, setActiveStop] = useState<EditorStop | null>(null);
  const dndId = useId();
  const snapshot = useRef<EditorDoc | null>(null);

  const dayOf = (id: string): string | undefined => {
    if (id.startsWith("day:")) return id.slice(4);
    return docRef.current.days.find((d) => d.stops.some((s) => s.id === id))?.id;
  };

  const onDragStart = (e: DragStartEvent) => {
    snapshot.current = docRef.current;
    const id = String(e.active.id);
    setActiveStop(docRef.current.days.flatMap((d) => d.stops).find((s) => s.id === id) ?? null);
  };
  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    const from = dayOf(String(active.id));
    const to = dayOf(String(over.id));
    if (!from || !to || from === to) return;
    const target = docRef.current.days.find((d) => d.id === to)!;
    const overIdx = String(over.id).startsWith("day:")
      ? target.stops.length
      : target.stops.findIndex((s) => s.id === over.id);
    preview((d) =>
      applyOp(d, {
        op: "stop.move",
        stopId: String(active.id),
        toDayId: to,
        toIndex: overIdx < 0 ? target.stops.length : overIdx,
      }),
    );
  };
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveStop(null);
    const before = snapshot.current;
    snapshot.current = null;
    if (!over || !before) {
      if (before) preview(() => before);
      return;
    }
    const stopId = String(active.id);
    const to = dayOf(String(over.id));
    if (!to) return;
    const day = docRef.current.days.find((d) => d.id === to)!;
    const activeIdx = day.stops.findIndex((s) => s.id === stopId);
    const overIdx = String(over.id).startsWith("day:")
      ? day.stops.length - 1
      : day.stops.findIndex((s) => s.id === over.id);
    const finalIdx = overIdx >= 0 && overIdx !== activeIdx ? overIdx : activeIdx;
    const fromDay = before.days.find((d) => d.stops.some((s) => s.id === stopId));
    const fromIdx = fromDay?.stops.findIndex((s) => s.id === stopId);
    if (fromDay?.id === to && fromIdx === finalIdx) {
      preview(() => before);
      return;
    }
    // Restore the pre-drag doc, then apply the one real move (saved).
    preview(() => before);
    dispatch({ op: "stop.move", stopId, toDayId: to, toIndex: Math.max(0, finalIdx) });
  };

  // ── Day order (tab strip drag, or Move up/down) ──
  const moveDay = (dayId: string, dir: -1 | 1) => {
    const ids = doc.days.map((d) => d.id);
    const i = ids.indexOf(dayId);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    dispatch({ op: "day.reorder", order: arrayMove(ids, i, j) });
  };
  const addDay = (after: string | null) => {
    const prev = after ? doc.days.find((d) => d.id === after) : doc.days[doc.days.length - 1];
    const dayId = crypto.randomUUID();
    dispatch({
      op: "day.add",
      dayId,
      after: after ?? prev?.id ?? null,
      title: "New day",
      city: prev?.city ?? "",
    });
    setTimeout(
      () => document.getElementById(`day-${dayId}`)?.scrollIntoView({ behavior: "smooth" }),
      50,
    );
  };

  const nights = Math.max(0, doc.days.length - 1);
  const pax = doc.client?.pax;
  const cities = useMemo(
    () => [...new Set(doc.days.map((d) => d.city).filter(Boolean))],
    [doc.days],
  );
  const meta = [
    doc.startDate && doc.endDate ? formatWeekdayRange(doc.startDate, doc.endDate) : "Dates not set",
    `${nights} ${nights === 1 ? "night" : "nights"}`,
    pax
      ? `${pax.adults} ${pax.adults === 1 ? "adult" : "adults"}${pax.children ? `, ${pax.children} ${pax.children === 1 ? "child" : "children"}` : ""}`
      : null,
    [doc.budget ? BUDGET_WORD[doc.budget] : null, doc.pace].filter(Boolean).join(", ") || null,
  ]
    .filter(Boolean)
    .join(" · ");

  const dayToDelete = doc.days.find((d) => d.id === confirmDay);

  return (
    <>
      <EditorBar
        doc={doc}
        status={status}
        onRetry={retry}
        onStatus={(s) => dispatch({ op: "itinerary.set", status: s })}
        onDuplicate={() => startNav(() => flush().then(() => duplicateItinerary(doc.id)))}
        onTemplate={() => startNav(() => flush().then(() => saveAsTemplate(doc.id)))}
        onDelete={() => setConfirmDelete(true)}
        onShare={() => void flush().then(() => setShareOpen(true))}
        onPreview={() =>
          void flush()
            .then(() => openShare(doc.id))
            .then((r) => r.ok && window.open(r.data.url, "_blank", "noopener"))
        }
        busy={pendingNav}
      />
      {!doc.isTemplate && (
        <SharePanel
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          agencyName={agencyName}
          target={{
            id: doc.id,
            title: doc.title,
            status: doc.status,
            destination: doc.destination,
            clientName: doc.client?.name ?? "",
            clientPhone: doc.client?.phone ?? "",
            dayCount: doc.days.length,
            unverified: doc.days.flatMap((d, i) =>
              d.hotel && !d.hotel.verified
                ? [{ label: `Night ${i + 1}, ${d.city || d.hotel.name}`, anchor: `day-${d.id}` }]
                : [],
            ),
          }}
          onStatus={(s) => dispatch({ op: "itinerary.set", status: s })}
          onShared={() => {
            if (doc.status === "draft") dispatch({ op: "itinerary.set", status: "sent" });
          }}
          onJump={(anchor) =>
            document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "start" })
          }
        />
      )}

      <div className="border-line bg-surface sticky top-14 z-20 border-b px-4 py-2 lg:hidden">
        <SegmentedControl
          ariaLabel="Editor view"
          value={tab}
          onChange={setTab}
          segments={[
            { value: "days", label: "Days" },
            { value: "details", label: "Details and price" },
          ]}
          className="w-full [&>button]:flex-1"
        />
      </div>

      <div className="lg:grid lg:grid-cols-[1fr_320px] xl:grid-cols-[1fr_360px]">
        <main
          className={cn(
            "min-w-0 px-4 pb-24 sm:px-8 lg:px-12 xl:px-24",
            tab === "details" && "hidden lg:block",
          )}
        >
          <div className="mx-auto max-w-[800px]">
            <header className="border-line flex flex-col gap-3 border-b pt-6 pb-5 lg:pt-10">
              <SectionLabel>
                {[doc.destination, cities.join(", ")].filter(Boolean).join(" · ")}
              </SectionLabel>
              {doc.isTemplate && <NeutralBadge className="w-fit">Template</NeutralBadge>}
              <InlineText
                multiline
                value={doc.title}
                label="Itinerary title"
                maxLength={120}
                onChange={(v) => v.trim() && dispatch({ op: "itinerary.set", title: v })}
                className="text-display-2 text-ink"
              />
              <p className="text-body-sm text-ink-secondary tnum">{meta}</p>
              <DayStrip
                doc={doc}
                onReorder={(order) => dispatch({ op: "day.reorder", order })}
                onAdd={() => addDay(null)}
              />
            </header>

            <DndContext
              id={dndId}
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDragEnd={onDragEnd}
              onDragCancel={() => {
                if (snapshot.current) preview(() => snapshot.current!);
                snapshot.current = null;
                setActiveStop(null);
              }}
            >
              {doc.days.map((day, i) => (
                <DaySection
                  key={day.id}
                  day={day}
                  index={i}
                  total={doc.days.length}
                  itineraryId={doc.id}
                  dispatch={dispatch}
                  collapsed={collapsed.has(day.id)}
                  regenerating={regen[day.id] ?? null}
                  regenError={regenErr[day.id] || null}
                  actions={{
                    onRegenerate: () => void onRegenerate(day.id),
                    onMove: (dir) => moveDay(day.id, dir),
                    onAddAfter: () => addDay(day.id),
                    onDelete: () => setConfirmDay(day.id),
                    onToggle: () =>
                      setCollapsed((c) => {
                        const n = new Set(c);
                        if (n.has(day.id)) n.delete(day.id);
                        else n.add(day.id);
                        return n;
                      }),
                  }}
                />
              ))}
              <DragOverlay>
                {activeStop ? (
                  <div className="border-line bg-surface-raised shadow-float rounded-md border px-2">
                    <StopContent stop={activeStop} />
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>

            <button
              type="button"
              onClick={() => addDay(null)}
              className="focus-ring text-body-sm text-ink mt-6 flex items-center gap-2 rounded-sm font-medium"
            >
              <Plus aria-hidden className="size-4" /> Add a day at the end
            </button>
          </div>
        </main>

        <aside
          aria-label="Client and price"
          className={cn(
            "border-line bg-surface-raised lg:sticky lg:top-14 lg:h-[calc(100dvh-56px)] lg:overflow-y-auto lg:border-l",
            tab === "days" && "hidden lg:block",
          )}
        >
          <SidePanel doc={doc} dispatch={dispatch} defaults={defaults} />
        </aside>
      </div>

      <Dialog
        open={!!dayToDelete}
        onClose={() => setConfirmDay(null)}
        title={`Delete Day ${doc.days.findIndex((d) => d.id === confirmDay) + 1}?`}
        description={
          dayToDelete
            ? `“${dayToDelete.title}”, its stops and its hotel are removed. Later days move up a date.`
            : null
        }
      >
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmDay(null)}>
            Keep it
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (confirmDay) dispatch({ op: "day.remove", dayId: confirmDay });
              setConfirmDay(null);
            }}
          >
            Delete day
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Delete ${doc.isTemplate ? "this template" : "this itinerary"}?`}
        description="It disappears from your list. Shared links stop working."
      >
        <form
          action={async () => {
            await flush();
            await deleteItinerary(doc.id);
          }}
          className="flex justify-end gap-2"
        >
          <Button type="button" variant="ghost" onClick={() => setConfirmDelete(false)}>
            Keep it
          </Button>
          <Button type="submit" variant="destructive">
            Delete
          </Button>
        </form>
      </Dialog>
    </>
  );
}

function EditorBar({
  doc,
  status,
  onRetry,
  onStatus,
  onDuplicate,
  onTemplate,
  onDelete,
  onShare,
  onPreview,
  busy,
}: {
  doc: EditorDoc;
  status: SaveStatus;
  onRetry: () => void;
  onStatus: (s: EditorDoc["status"]) => void;
  onDuplicate: () => void;
  onTemplate: () => void;
  onDelete: () => void;
  onShare: () => void;
  onPreview: () => void;
  busy: boolean;
}) {
  const more = (
    <Menu
      label="More actions"
      trigger={(p) => (
        <button
          type="button"
          {...p}
          className="focus-ring text-ink-secondary hover:text-ink hover:bg-surface-sunken grid size-9 place-items-center rounded-md"
        >
          <MoreHorizontal aria-hidden className="size-4" />
        </button>
      )}
      items={[
        { label: "Duplicate", icon: <Copy />, onSelect: onDuplicate, disabled: busy },
        ...(doc.isTemplate
          ? []
          : [
              {
                label: "Save as template",
                icon: <LayoutTemplate />,
                onSelect: onTemplate,
                disabled: busy,
              },
            ]),
        "separator" as const,
        { label: "Delete", icon: <Trash2 />, onSelect: onDelete, danger: true },
      ]}
    />
  );

  return (
    <header className="border-line bg-surface sticky top-0 z-30 h-14 border-b">
      <div className="flex h-full items-center gap-3 px-4 sm:px-6">
        <Link
          href="/app"
          aria-label="Back to itineraries"
          className="focus-ring text-ink-secondary hover:text-ink grid size-8 shrink-0 place-items-center rounded-md"
        >
          <ChevronLeft aria-hidden className="size-4" />
        </Link>
        <div className="flex min-w-0 flex-col sm:flex-row sm:items-center sm:gap-4">
          <span className="text-heading-3 text-ink truncate">{doc.title}</span>
          <span className="flex items-center gap-2">
            <SaveState
              state={status.state === "idle" ? "saved" : status.state}
              at={status.at}
              onRetry={onRetry}
              className="text-caption sm:text-body-sm"
            />
            {status.state === "failed" && status.message && (
              <span className="text-caption text-ink-muted hidden xl:inline">{status.message}</span>
            )}
            <span className="text-caption text-ink-muted sm:hidden">
              · {STATUS_WORD[doc.status]}
            </span>
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {!doc.isTemplate && (
            <Menu
              label="Itinerary status"
              className="hidden sm:block"
              trigger={(p) => (
                <button
                  type="button"
                  {...p}
                  className="focus-ring hover:bg-surface-sunken flex h-9 items-center gap-1.5 rounded-md px-2"
                >
                  <StatusDot status={doc.status} />
                  <ChevronDown aria-hidden className="text-ink-secondary size-3.5" />
                </button>
              )}
              items={ITINERARY_STATUSES.map((s) => ({
                label: STATUS_WORD[s],
                onSelect: () => onStatus(s),
              }))}
            />
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onPreview}
            disabled={doc.isTemplate}
            title={doc.isTemplate ? "Templates have no client page" : "Open the client page"}
            className="hidden md:inline-flex"
          >
            <Eye aria-hidden /> Preview
          </Button>
          {doc.isTemplate ? (
            <form action={startFromTemplate.bind(null, doc.id)}>
              <Button type="submit" size="sm" className="h-9">
                Use template
              </Button>
            </form>
          ) : (
            <Button size="sm" className="h-9 px-4" onClick={onShare}>
              Share
            </Button>
          )}
          {more}
        </div>
      </div>
    </header>
  );
}

/** "Day 1 Srinagar · Day 2 Gulmarg …" — click scrolls, drag reorders (PNG 11). */
function DayStrip({
  doc,
  onReorder,
  onAdd,
}: {
  doc: EditorDoc;
  onReorder: (order: string[]) => void;
  onAdd: () => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = doc.days.map((d) => d.id);
  const dndId = useId();
  return (
    <nav aria-label="Days" className="-mx-1 mt-2 overflow-x-auto">
      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={({ active, over }) => {
          if (!over || active.id === over.id) return;
          onReorder(arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))));
        }}
      >
        <SortableContext items={ids} strategy={horizontalListSortingStrategy}>
          <ol className="flex items-center gap-1 whitespace-nowrap">
            {doc.days.map((d, i) => (
              <DayTab key={d.id} id={d.id} label={`Day ${i + 1}`} city={d.city} />
            ))}
            <li>
              <button
                type="button"
                onClick={onAdd}
                className="focus-ring text-body-sm text-ink-secondary hover:text-ink flex h-8 items-center gap-1.5 rounded-md px-2"
              >
                <Plus aria-hidden className="size-3.5" /> Add day
              </button>
            </li>
          </ol>
        </SortableContext>
      </DndContext>
    </nav>
  );
}

function DayTab({ id, label, city }: { id: string; label: string; city: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(isDragging && "bg-surface-raised shadow-float z-10 rounded-md")}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-roledescription="sortable day"
        onClick={() =>
          document
            .getElementById(`day-${id}`)
            ?.scrollIntoView({ behavior: "smooth", block: "start" })
        }
        className="focus-ring text-body-sm text-ink-secondary hover:text-ink hover:bg-surface-sunken flex h-8 cursor-grab items-center gap-1.5 rounded-md px-2 active:cursor-grabbing"
      >
        <span className="text-ink font-medium">{label}</span>
        {city && <span>{city}</span>}
      </button>
    </li>
  );
}
