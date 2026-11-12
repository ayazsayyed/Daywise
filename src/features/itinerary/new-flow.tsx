"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowRight, ChevronLeft, Plus, X } from "lucide-react";

import { FlowBar, SectionLabel, SegmentedControl } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BUDGET_TIERS, PACES, type Brief } from "@/lib/ai/schemas";
import { formatWeekdayRange } from "@/lib/format";
import { addDays } from "@/lib/itinerary/doc";
import { cn } from "@/lib/utils";

import { enhanceRequest, startFromTemplate, startGeneration } from "./actions";

const EXAMPLES = [
  "5-day Kashmir for a couple, mid-range, with a shikara ride and Gulmarg",
  "Kerala for a family of four, two kids under 10, Munnar and an Alleppey houseboat, Christmas week",
  "Dubai honeymoon, 4 nights, luxury, desert dinner and Burj Khalifa at sunset",
];

const BUDGET_LABEL: Record<(typeof BUDGET_TIERS)[number], string> = {
  budget: "Budget",
  "mid-range": "Mid-range",
  premium: "Premium",
  luxury: "Luxury",
};
const PACE_LABEL: Record<(typeof PACES)[number], string> = {
  relaxed: "Relaxed",
  balanced: "Balanced",
  packed: "Packed",
};

export type TemplateOption = { id: string; title: string; meta: string };

export function NewItineraryFlow({ templates }: { templates: TemplateOption[] }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [prompt, setPrompt] = useState("");
  const [brief, setBrief] = useState<Brief | null>(null);

  return (
    <>
      <FlowBar backHref="/app" backLabel="Itineraries" center={`New itinerary · Step ${step} of 3`}>
        <a href="/app" className="focus-ring text-body-sm text-ink rounded-sm font-medium">
          Cancel
        </a>
      </FlowBar>
      {step === 1 || !brief ? (
        <Describe
          prompt={prompt}
          setPrompt={setPrompt}
          templates={templates}
          onBrief={(b) => {
            setBrief(b);
            setStep(2);
            window.scrollTo(0, 0);
          }}
        />
      ) : (
        <CheckBrief prompt={prompt} brief={brief} setBrief={setBrief} onBack={() => setStep(1)} />
      )}
    </>
  );
}

// ── Step 1 (PNG 08) ──────────────────────────────────────────────────────
function Describe({
  prompt,
  setPrompt,
  templates,
  onBrief,
}: {
  prompt: string;
  setPrompt: (p: string) => void;
  templates: TemplateOption[];
  onBrief: (b: Brief) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => ref.current?.focus(), []);

  const submit = () => {
    if (pending) return;
    if (prompt.trim().length < 4) {
      setError("Describe the trip in a few words first.");
      return;
    }
    setError(null);
    start(async () => {
      const res = await enhanceRequest(prompt);
      if (res.ok) onBrief(res.brief);
      else setError(res.error);
    });
  };

  return (
    <main className="mx-auto w-full max-w-[704px] px-4 pt-12 pb-24 sm:px-8 lg:pt-28">
      <h1 className="text-display-1 text-ink">Describe the trip</h1>
      <p className="text-body text-ink-secondary mt-4 max-w-[640px]">
        Destination, length, who is travelling and the budget is enough. Add anything the client
        mentioned: dates, must-sees, pace, the city they fly into.
      </p>

      <form
        className="mt-12 flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Label htmlFor="trip-request">Trip request</Label>
        <Textarea
          id="trip-request"
          ref={ref}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              submit();
            }
          }}
          rows={5}
          maxLength={1000}
          aria-invalid={!!error}
          aria-describedby="trip-request-hint"
          placeholder="5-day Kashmir for a couple, mid-range. Flying into Srinagar mid-March."
          className="min-h-[168px] resize-y px-5 py-4 text-[17px] leading-[28px]"
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
          <p
            id="trip-request-hint"
            className={cn("text-caption", error ? "text-danger" : "text-ink-muted")}
            role={error ? "alert" : undefined}
          >
            {error ?? "Ctrl + Enter to continue · Hindi and Hinglish work too"}
          </p>
          <Button type="submit" disabled={pending}>
            {pending ? "Reading the request…" : "Continue"}
            {!pending && <ArrowRight aria-hidden />}
          </Button>
        </div>
      </form>

      <section className="mt-16" aria-labelledby="examples">
        <SectionLabel id="examples">Or start from an example</SectionLabel>
        <ul className="border-line mt-3 border-t">
          {EXAMPLES.map((ex) => (
            <li key={ex} className="border-line border-b">
              <button
                type="button"
                onClick={() => {
                  setPrompt(ex);
                  setError(null);
                  ref.current?.focus();
                }}
                className="focus-ring text-body text-ink hover:bg-surface-sunken flex w-full items-center justify-between gap-6 py-4 text-left"
              >
                <span>{ex}</span>
                <ArrowRight aria-hidden className="text-ink-secondary size-4 shrink-0" />
              </button>
            </li>
          ))}
        </ul>
      </section>

      {templates.length > 0 && (
        <section className="mt-12" aria-labelledby="templates">
          <SectionLabel id="templates">Or start from a template</SectionLabel>
          <ul className="border-line mt-3 border-t">
            {templates.map((t) => (
              <li key={t.id} className="border-line border-b">
                <form action={startFromTemplate.bind(null, t.id)}>
                  <button
                    type="submit"
                    className="focus-ring hover:bg-surface-sunken flex w-full items-center justify-between gap-6 py-4 text-left"
                  >
                    <span className="flex flex-col">
                      <span className="text-body text-ink">{t.title}</span>
                      <span className="text-caption text-ink-muted">{t.meta}</span>
                    </span>
                    <ArrowRight aria-hidden className="text-ink-secondary size-4 shrink-0" />
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

// ── Step 2 (PNG 09) ──────────────────────────────────────────────────────
type FieldKey =
  | "destination"
  | "cities"
  | "pax"
  | "start_date"
  | "nights"
  | "entry_city"
  | "exit_city"
  | "budget"
  | "pace"
  | "season";

const VISIBLE_FIELDS = new Set<FieldKey>([
  "destination",
  "cities",
  "pax",
  "start_date",
  "nights",
  "entry_city",
  "exit_city",
  "budget",
  "pace",
]);

function CheckBrief({
  prompt,
  brief,
  setBrief,
  onBack,
}: {
  prompt: string;
  brief: Brief;
  setBrief: (b: Brief) => void;
  onBack: () => void;
}) {
  const [assumed, setAssumed] = useState(() => new Set(brief.assumed));
  const [clientName, setClientName] = useState("");
  const [citiesText, setCitiesText] = useState(brief.cities.join(", "));
  const [newMustSee, setNewMustSee] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  /** Only fields shown on this form count (season, for instance, has no field). */
  const assumedCount = [...assumed].filter((k) => VISIBLE_FIELDS.has(k as FieldKey)).length;

  /** Editing a field confirms it: the highlight goes. */
  const update = (key: FieldKey, patch: Partial<Brief>) => {
    setBrief({ ...brief, ...patch });
    if (assumed.has(key)) {
      const next = new Set(assumed);
      next.delete(key);
      setAssumed(next);
    }
  };
  const isAssumed = (k: FieldKey) => assumed.has(k);

  const submit = () => {
    const cities = citiesText
      .split(",")
      .map((c) => c.trim())
      .filter((c) => c.length >= 2);
    if (!cities.length) {
      setError("Add at least one city on the route.");
      return;
    }
    setError(null);
    const final: Brief = { ...brief, cities, assumed: [...assumed] };
    start(async () => {
      const res = await startGeneration({ prompt, brief: final, clientName });
      if (res && "error" in res) setError(res.error);
    });
  };

  const dates = brief.start_date
    ? formatWeekdayRange(brief.start_date, addDays(brief.start_date, brief.nights))
    : null;

  return (
    <main className="mx-auto w-full max-w-[760px] px-4 pt-10 pb-24 sm:px-8 lg:pt-16">
      <h1 className="text-display-2 text-ink">Check the brief</h1>

      <div className="border-line mt-6 flex items-start justify-between gap-6 border-y py-4">
        <p className="text-body-sm text-ink-secondary">“{prompt.trim()}”</p>
        <button
          type="button"
          onClick={onBack}
          className="focus-ring text-body-sm text-ink shrink-0 rounded-sm font-medium"
        >
          Edit request
        </button>
      </div>

      {assumedCount > 0 && (
        <p className="text-caption text-ink-secondary mt-4 flex items-center gap-2">
          <span aria-hidden className="bg-indigo-soft border-line size-3 rounded-sm border" />
          {assumedCount === 1
            ? "1 detail was assumed, not stated. It is highlighted."
            : `${assumedCount} details were assumed, not stated. They are highlighted.`}{" "}
          Change anything that is wrong before generating.
        </p>
      )}

      <form
        className="border-line bg-surface-raised mt-6 rounded-lg border"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="flex flex-col gap-5 p-4 sm:p-5">
          <BriefField
            label="Client name"
            htmlFor="client"
            hint="Used for the itinerary title. Not shared until you share."
          >
            <Input
              id="client"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Ananya & Rohit Kapoor"
              maxLength={120}
              autoComplete="off"
            />
          </BriefField>

          <div className="grid gap-5 sm:grid-cols-2">
            <BriefField
              label="Destination"
              htmlFor="destination"
              assumed={isAssumed("destination")}
            >
              <Input
                id="destination"
                value={brief.destination}
                onChange={(e) => update("destination", { destination: e.target.value })}
                className={assumedBg(isAssumed("destination"))}
                maxLength={80}
              />
            </BriefField>
            <BriefField label="Travellers" htmlFor="adults" assumed={isAssumed("pax")}>
              <div className="flex gap-3">
                <NumberWithUnit
                  id="adults"
                  value={brief.pax.adults}
                  min={1}
                  max={40}
                  unit={brief.pax.adults === 1 ? "adult" : "adults"}
                  assumed={isAssumed("pax")}
                  onChange={(n) => update("pax", { pax: { ...brief.pax, adults: n } })}
                />
                <NumberWithUnit
                  id="children"
                  value={brief.pax.children}
                  min={0}
                  max={20}
                  unit={brief.pax.children === 1 ? "child" : "children"}
                  assumed={isAssumed("pax")}
                  onChange={(n) =>
                    update("pax", {
                      pax: {
                        ...brief.pax,
                        children: n,
                        child_ages: brief.pax.child_ages.slice(0, n),
                      },
                    })
                  }
                />
              </div>
            </BriefField>
          </div>

          <BriefField
            label="Route"
            htmlFor="cities"
            assumed={isAssumed("cities")}
            hint="Cities in order, separated by commas."
          >
            <Input
              id="cities"
              value={citiesText}
              onChange={(e) => {
                setCitiesText(e.target.value);
                update("cities", {});
              }}
              className={assumedBg(isAssumed("cities"))}
            />
          </BriefField>

          <div className="grid gap-5 sm:grid-cols-2">
            <BriefField
              label="Dates"
              htmlFor="start"
              assumed={isAssumed("start_date")}
              hint={dates ?? "Leave empty if the dates are not fixed."}
            >
              <Input
                id="start"
                type="date"
                value={brief.start_date ?? ""}
                onChange={(e) => update("start_date", { start_date: e.target.value || null })}
                className={assumedBg(isAssumed("start_date"))}
              />
            </BriefField>
            <BriefField label="Length" htmlFor="nights" assumed={isAssumed("nights")}>
              <NumberWithUnit
                id="nights"
                value={brief.nights}
                min={1}
                max={30}
                unit={`${brief.nights === 1 ? "night" : "nights"} · ${brief.nights + 1} days`}
                assumed={isAssumed("nights")}
                onChange={(n) => update("nights", { nights: n })}
              />
            </BriefField>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <BriefField label="Entry city" htmlFor="entry" assumed={isAssumed("entry_city")}>
              <Input
                id="entry"
                value={brief.entry_city ?? ""}
                onChange={(e) => update("entry_city", { entry_city: e.target.value || null })}
                className={assumedBg(isAssumed("entry_city"))}
                maxLength={60}
              />
            </BriefField>
            <BriefField label="Exit city" htmlFor="exit" assumed={isAssumed("exit_city")}>
              <Input
                id="exit"
                value={brief.exit_city ?? ""}
                onChange={(e) => update("exit_city", { exit_city: e.target.value || null })}
                className={assumedBg(isAssumed("exit_city"))}
                maxLength={60}
              />
            </BriefField>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <BriefField label="Budget tier" htmlFor="budget" assumed={isAssumed("budget")}>
              <SegmentedControl
                ariaLabel="Budget tier"
                value={brief.budget}
                onChange={(v) => update("budget", { budget: v })}
                segments={BUDGET_TIERS.map((t) => ({ value: t, label: BUDGET_LABEL[t] }))}
                className={cn("w-full [&>button]:flex-1", isAssumed("budget") && "bg-indigo-soft")}
              />
            </BriefField>
            <BriefField label="Pace" htmlFor="pace" assumed={isAssumed("pace")}>
              <SegmentedControl
                ariaLabel="Pace"
                value={brief.pace}
                onChange={(v) => update("pace", { pace: v })}
                segments={PACES.map((p) => ({ value: p, label: PACE_LABEL[p] }))}
                className={cn("w-full [&>button]:flex-1", isAssumed("pace") && "bg-indigo-soft")}
              />
            </BriefField>
          </div>
        </div>

        <div className="border-line flex flex-col gap-2 border-t p-4 sm:p-5">
          <span className="text-label text-ink-secondary">Must-sees</span>
          <ul className="flex flex-col">
            {brief.must_sees.map((m, i) => (
              <li
                key={`${m}-${i}`}
                className="border-line text-body-sm text-ink flex h-11 items-center justify-between gap-4 border-b px-2"
              >
                <span>{m}</span>
                <button
                  type="button"
                  aria-label={`Remove ${m}`}
                  onClick={() =>
                    setBrief({ ...brief, must_sees: brief.must_sees.filter((_, j) => j !== i) })
                  }
                  className="focus-ring text-ink-secondary hover:text-ink rounded-sm p-1"
                >
                  <X aria-hidden className="size-4" />
                </button>
              </li>
            ))}
          </ul>
          {newMustSee === null ? (
            <button
              type="button"
              onClick={() => setNewMustSee("")}
              className="focus-ring text-body-sm text-ink mt-1 flex w-fit items-center gap-2 rounded-sm px-2 py-2 font-medium"
            >
              <Plus aria-hidden className="size-4" /> Add a must-see
            </button>
          ) : (
            <div className="mt-2 flex gap-2">
              <Input
                autoFocus
                aria-label="New must-see"
                value={newMustSee}
                maxLength={80}
                onChange={(e) => setNewMustSee(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const v = newMustSee.trim();
                    if (v.length >= 2) setBrief({ ...brief, must_sees: [...brief.must_sees, v] });
                    setNewMustSee(null);
                  }
                  if (e.key === "Escape") setNewMustSee(null);
                }}
                placeholder="Shikara ride on Dal Lake"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  const v = newMustSee.trim();
                  if (v.length >= 2) setBrief({ ...brief, must_sees: [...brief.must_sees, v] });
                  setNewMustSee(null);
                }}
              >
                Add
              </Button>
            </div>
          )}
        </div>

        <div className="border-line border-t p-4 sm:p-5">
          <BriefField label="Notes for the draft" htmlFor="notes">
            <Input
              id="notes"
              value={brief.notes ?? ""}
              maxLength={600}
              onChange={(e) => setBrief({ ...brief, notes: e.target.value || null })}
              placeholder="Anything else, like a vegetarian couple or no early starts"
            />
          </BriefField>
        </div>
      </form>

      {error && (
        <p className="text-body-sm text-danger mt-4" role="alert">
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBack}
          className="focus-ring text-body-sm text-ink flex items-center gap-1.5 rounded-sm font-medium"
        >
          <ChevronLeft aria-hidden className="size-4" /> Back
        </button>
        <div className="flex items-center gap-4">
          <span className="text-caption text-ink-muted hidden sm:inline">
            Takes about 35 seconds
          </span>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Starting…" : "Generate itinerary"}
          </Button>
        </div>
      </div>
    </main>
  );
}

function BriefField({
  label,
  htmlFor,
  assumed,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  assumed?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={htmlFor}>{label}</Label>
        {assumed && <span className="text-caption text-indigo">Assumed</span>}
      </div>
      {children}
      {hint && <p className="text-caption text-ink-muted">{hint}</p>}
    </div>
  );
}

function NumberWithUnit({
  id,
  value,
  min,
  max,
  unit,
  assumed,
  onChange,
}: {
  id: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  assumed?: boolean;
  onChange: (n: number) => void;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "border-line-strong bg-surface-raised focus-within:border-indigo focus-within:ring-indigo flex h-10 w-full min-w-0 items-center gap-2 rounded-md border px-3 focus-within:ring-2 focus-within:ring-offset-2",
        assumedBg(!!assumed),
      )}
    >
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const n = Math.round(Number(e.target.value));
          if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
        }}
        className="text-body text-ink tnum w-8 min-w-0 bg-transparent outline-none"
      />
      <span className="text-body text-ink-secondary truncate">{unit}</span>
    </label>
  );
}

function assumedBg(on: boolean) {
  return on ? "bg-indigo-soft" : undefined;
}
