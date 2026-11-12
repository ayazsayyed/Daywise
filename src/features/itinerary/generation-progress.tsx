"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, Circle, LoaderCircle } from "lucide-react";

import { FlowBar, SectionLabel } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { formatWeekdayDate } from "@/lib/format";
import { addDays } from "@/lib/itinerary/doc";
import { cn } from "@/lib/utils";

import { getGenerationStatus, retryGeneration, type JobView } from "./actions";

const STEPS = [
  { key: "enhancing", label: "Enhancing the brief" },
  { key: "drafting", label: "Drafting days" },
  { key: "verifying", label: "Verifying hotels and places" },
  { key: "photos", label: "Adding photos" },
] as const;
const ORDER = ["queued", "enhancing", "drafting", "verifying", "photos", "done"];
const ESTIMATE_MS = 35_000;

type BriefInfo = {
  destination: string;
  nights: number;
  adults: number;
  children: number;
  startDate: string | null;
} | null;

/** PNG 10: four steps with results, elapsed/left bar, "Drafted so far" as soon as drafting is done. */
export function GenerationProgress({
  jobId,
  initial,
  brief,
  clientName,
}: {
  jobId: string;
  initial: JobView;
  brief: BriefInfo;
  clientName: string | null;
}) {
  const router = useRouter();
  const [job, setJob] = useState(initial);
  const [now, setNow] = useState(() => Date.now());
  const [started] = useState(() => Date.now() - initial.elapsedMs);

  useEffect(() => {
    if (job.status === "done" || job.status === "failed") return;
    const poll = setInterval(async () => {
      const next = await getGenerationStatus(jobId).catch(() => null);
      if (next) setJob(next);
    }, 1_500);
    const tick = setInterval(() => setNow(Date.now()), 500);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [job.status, jobId]);

  useEffect(() => {
    if (job.status === "done" && job.itineraryId) router.replace(`/app/i/${job.itineraryId}`);
  }, [job.status, job.itineraryId, router]);

  const elapsed = Math.max(0, now - started);
  const done = job.status === "done";
  const failed = job.status === "failed";
  const pct = done ? 100 : Math.min(95, (elapsed / ESTIMATE_MS) * 100);
  const left = Math.max(0, Math.round((ESTIMATE_MS - elapsed) / 1000));
  const current = ORDER.indexOf(job.status);
  const resultOf = (k: string) => job.progress.steps.find((s) => s.name === k);

  const title = brief
    ? `Drafting ${brief.destination}${clientName ? ` for ${clientName}` : ""}`
    : "Drafting the itinerary";
  const eyebrow = brief
    ? [
        brief.destination,
        `${brief.nights} ${brief.nights === 1 ? "night" : "nights"}`,
        `${brief.adults} ${brief.adults === 1 ? "adult" : "adults"}${brief.children ? `, ${brief.children} ${brief.children === 1 ? "child" : "children"}` : ""}`,
      ].join(" · ")
    : null;

  return (
    <>
      <FlowBar backHref="/app" backLabel="Itineraries" center="New itinerary · Step 3 of 3" />
      <main className="mx-auto w-full max-w-[704px] px-4 pt-12 pb-24 sm:px-8 lg:pt-24">
        {eyebrow && <SectionLabel>{eyebrow}</SectionLabel>}
        <h1 className="text-display-2 text-ink mt-3">{title}</h1>
        <p className="text-body text-ink-secondary mt-3 max-w-[600px]">
          Usually 30 to 40 seconds. You can leave this page; the itinerary keeps building and opens
          from your list when it is ready.
        </p>

        <div className="mt-8" aria-hidden={failed}>
          <div className="bg-line h-0.5 w-full overflow-hidden">
            <div
              className={cn(
                "h-full transition-[width] duration-500",
                failed ? "bg-danger" : "bg-indigo",
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="text-caption text-ink-muted tnum mt-2 flex justify-between">
            <span>{Math.round(elapsed / 1000)} s elapsed</span>
            <span>
              {done
                ? "Opening the editor"
                : failed
                  ? "Stopped"
                  : left > 0
                    ? `About ${left} s left`
                    : "Almost there"}
            </span>
          </div>
        </div>

        <ol className="border-line mt-8 border-t">
          {STEPS.map((s, i) => {
            const res = resultOf(s.key);
            const stepIdx = i + 1;
            const state = res
              ? "done"
              : failed
                ? "stopped"
                : current === stepIdx
                  ? "active"
                  : "waiting";
            return (
              <li key={s.key} className="border-line flex h-12 items-center gap-3 border-b">
                {state === "done" ? (
                  <Check aria-hidden className="text-green size-4" />
                ) : state === "active" ? (
                  <LoaderCircle aria-hidden className="text-indigo size-4 animate-spin" />
                ) : (
                  <Circle aria-hidden className="text-ink-muted size-3.5" />
                )}
                <span
                  className={cn(
                    "text-body-sm",
                    state === "waiting" || state === "stopped" ? "text-ink-muted" : "text-ink",
                    state === "active" && "font-medium",
                  )}
                >
                  {s.label}
                </span>
                <span
                  className={cn(
                    "text-caption tnum ml-auto text-right",
                    state === "active" ? "text-indigo" : "text-ink-muted",
                  )}
                >
                  {res
                    ? res.ms > 0
                      ? `${res.result} · ${Math.max(1, Math.round(res.ms / 1000))} s`
                      : res.result
                    : state === "active"
                      ? "Working"
                      : state === "stopped"
                        ? "Not run"
                        : "Waiting"}
                </span>
              </li>
            );
          })}
        </ol>

        {failed && (
          <div className="mt-8 flex flex-col gap-4" role="alert">
            <p className="text-body text-danger">
              {job.error ?? "The draft could not be finished."}
            </p>
            <div className="flex flex-wrap gap-3">
              <form action={retryGeneration.bind(null, jobId)}>
                <Button type="submit">Try again</Button>
              </form>
              <Button variant="secondary" asChild>
                <Link href="/app/new">Change the request</Link>
              </Button>
            </div>
          </div>
        )}

        {job.progress.days && job.progress.days.length > 0 && (
          <section className="mt-10" aria-labelledby="drafted">
            <SectionLabel id="drafted">Drafted so far</SectionLabel>
            <ol className="mt-3 flex flex-col gap-1.5">
              {job.progress.days.map((title, i) => (
                <li key={i} className="text-body-sm grid grid-cols-[88px_1fr] gap-4">
                  <span className="text-ink-muted tnum">
                    {brief?.startDate
                      ? formatWeekdayDate(addDays(brief.startDate, i))
                      : `Day ${i + 1}`}
                  </span>
                  <span className="text-ink">{title}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        <Link
          href="/app"
          className="focus-ring text-body-sm text-ink mt-10 inline-block rounded-sm font-medium"
        >
          Back to itineraries
        </Link>
      </main>
    </>
  );
}
