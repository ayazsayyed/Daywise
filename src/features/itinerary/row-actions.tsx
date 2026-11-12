"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowUpRight,
  Copy,
  Download,
  Link2,
  MessageCircle,
  MoreHorizontal,
  Trash2,
} from "lucide-react";

import { Dialog } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { deleteItinerary, duplicateItinerary } from "@/features/editor/actions";

import { startFromTemplate } from "./actions";

/** Desktop: actions revealed on row hover (PNG 06). Copy link and PDF arrive on Day 4. */
export function HoverActions({ id, template }: { id: string; template: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <Button variant="secondary" size="sm" asChild>
        <Link href={`/app/i/${id}`}>
          <ArrowUpRight aria-hidden /> Open
        </Link>
      </Button>
      {template ? (
        <form action={startFromTemplate.bind(null, id)}>
          <Button variant="secondary" size="sm" type="submit">
            <Copy aria-hidden /> Use template
          </Button>
        </form>
      ) : (
        <>
          <form action={duplicateItinerary.bind(null, id)}>
            <Button variant="secondary" size="sm" type="submit">
              <Copy aria-hidden /> Duplicate
            </Button>
          </form>
          <Button variant="secondary" size="sm" disabled title="Share links arrive on Day 4">
            <Link2 aria-hidden /> Copy link
          </Button>
          <Button variant="secondary" size="sm" disabled title="PDF arrives on Day 4">
            <Download aria-hidden /> PDF
          </Button>
        </>
      )}
    </div>
  );
}

/** Phone: "…" opens a bottom sheet of actions (PNG 18, deviation 8). */
export function SheetActions({
  id,
  title,
  meta,
  template,
}: {
  id: string;
  title: string;
  meta: string;
  template: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const row =
    "focus-ring text-body text-ink border-line flex h-14 w-full items-center gap-4 border-t px-1 text-left disabled:text-ink-muted";
  return (
    <>
      <button
        type="button"
        aria-label={`Actions for ${title}`}
        onClick={() => setOpen(true)}
        className="focus-ring text-ink-secondary relative z-10 grid size-10 place-items-center rounded-md"
      >
        <MoreHorizontal aria-hidden className="size-5" />
      </button>
      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
          setConfirm(false);
        }}
        title={title}
        description={meta}
        variant="sheet"
      >
        {confirm ? (
          <form action={deleteItinerary.bind(null, id)} className="flex flex-col gap-3">
            <p className="text-body-sm text-ink-secondary">
              It disappears from your list. Shared links stop working.
            </p>
            <Button type="submit" variant="destructive" className="h-12">
              Delete
            </Button>
            <Button type="button" variant="ghost" onClick={() => setConfirm(false)}>
              Keep it
            </Button>
          </form>
        ) : (
          <div className="flex flex-col">
            <Link href={`/app/i/${id}`} className={row}>
              <ArrowUpRight aria-hidden className="size-5" /> Open
            </Link>
            {template ? (
              <form action={startFromTemplate.bind(null, id)}>
                <button type="submit" className={row}>
                  <Copy aria-hidden className="size-5" /> Use template
                </button>
              </form>
            ) : (
              <>
                <form action={duplicateItinerary.bind(null, id)}>
                  <button type="submit" className={row}>
                    <Copy aria-hidden className="size-5" /> Duplicate
                  </button>
                </form>
                <button type="button" disabled className={row}>
                  <Link2 aria-hidden className="size-5" /> Copy link
                </button>
                <button type="button" disabled className={row}>
                  <MessageCircle aria-hidden className="size-5" /> Share on WhatsApp
                </button>
                <button type="button" disabled className={row}>
                  <Download aria-hidden className="size-5" /> Download PDF
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setConfirm(true)}
              className={cn(row, "text-danger")}
            >
              <Trash2 aria-hidden className="size-5" /> Delete
            </button>
          </div>
        )}
      </Dialog>
    </>
  );
}
