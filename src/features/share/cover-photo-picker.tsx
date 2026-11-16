"use client";

import { ChevronDown } from "lucide-react";
import { useState, useTransition } from "react";

import { cn } from "@/lib/utils";

import { getCoverPhotos, setCoverPhotos, type CoverPhotos } from "./actions";

/**
 * Share panel → "Cover photos": the two photos the PDF cover uses (Heritage
 * band, Photo-first hero). Picked automatically (landscape, two places,
 * day photos first); the agent can choose up to two or go back to automatic.
 */
export function CoverPhotoPicker({ itineraryId }: { itineraryId: string }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<CoverPhotos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const load = () =>
    start(async () => {
      const r = await getCoverPhotos(itineraryId);
      if (r.ok) setData(r.data);
      else setError(r.message);
    });

  const save = (refs: string[]) =>
    start(async () => {
      setError(null);
      const r = await setCoverPhotos(itineraryId, refs);
      if (r.ok) setData(r.data);
      else setError(r.message);
    });

  const toggle = (ref: string) => {
    if (!data) return;
    const cur = data.auto ? [] : data.selected;
    const next = cur.includes(ref) ? cur.filter((r) => r !== ref) : [...cur, ref].slice(-2);
    save(next);
  };

  return (
    <div className="border-line mt-3 rounded-md border">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => !v);
          if (!data) load();
        }}
        className="focus-ring flex w-full items-center justify-between gap-3 rounded-md px-4 py-3 text-left"
      >
        <span className="flex flex-col">
          <span className="text-heading-3 text-ink">Cover photos</span>
          <span className="text-caption text-ink-muted">
            {data
              ? data.auto
                ? "Picked automatically"
                : "Chosen by you"
              : "Two photos for the PDF cover"}
          </span>
        </span>
        <ChevronDown
          className={cn("text-ink-secondary size-4 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open ? (
        <div className="border-line border-t px-4 py-3">
          {!data ? (
            <p className="text-body-sm text-ink-secondary">
              {pending ? "Loading photos…" : "No photos yet."}
            </p>
          ) : data.options.length === 0 ? (
            <p className="text-body-sm text-ink-secondary">
              This itinerary has no photos yet. The cover uses destination photos instead.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2">
                {data.options.map((o) => {
                  const idx = data.selected.indexOf(o.ref);
                  return (
                    <button
                      key={o.ref}
                      type="button"
                      disabled={pending}
                      aria-pressed={idx >= 0}
                      aria-label={`${o.caption}${idx >= 0 ? `, cover photo ${idx + 1}` : ""}`}
                      onClick={() => toggle(o.ref)}
                      className={cn(
                        "focus-ring border-line bg-photo-sand relative aspect-[3/2] overflow-hidden rounded-md border",
                        idx >= 0 && "ring-indigo ring-offset-surface-raised ring-2 ring-offset-1",
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={o.url}
                        alt=""
                        loading="lazy"
                        className="absolute inset-0 size-full object-cover"
                      />
                      {idx >= 0 ? (
                        <span className="bg-indigo text-on-indigo absolute top-1 left-1 grid size-5 place-items-center rounded-sm text-[11px] font-semibold">
                          {idx + 1}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="text-caption text-ink-muted">
                  Choose up to two. Landscape photos print best.
                </p>
                {!data.auto ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => save([])}
                    className="focus-ring text-body-sm text-ink-secondary hover:text-ink rounded-sm"
                  >
                    Use automatic
                  </button>
                ) : null}
              </div>
            </>
          )}
          {error ? <p className="text-caption text-danger mt-2">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
