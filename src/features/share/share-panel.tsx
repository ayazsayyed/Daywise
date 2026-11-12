"use client";

import { Check, FileText, MessageCircle, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Switch } from "@/components/ds";
import { StatusDot, type ItineraryStatus } from "@/components/ds/status-dot";
import { Button } from "@/components/ui/button";
import { formatDate, relativeDay } from "@/lib/format";
import { cn } from "@/lib/utils";

import {
  getPdfJob,
  openShare,
  requestPdf,
  setLinkEnabled,
  type PdfJobState,
  type ShareState,
} from "./actions";
import { agentShareMessage, waHref } from "./whatsapp";

/**
 * Share panel (PNG 14): link on/off + copy, WhatsApp with the prefilled
 * message (editable), Download PDF ("Preparing…" until the job is done, then
 * the download starts on its own), client activity and status. The first
 * share (copy, WhatsApp or PDF) moves a draft to Sent via `onShared`.
 * Indigo is spent once: on "Share on WhatsApp".
 */
export type ShareTarget = {
  id: string;
  title: string;
  status: ItineraryStatus;
  destination: string;
  clientName: string;
  clientPhone: string;
  dayCount: number;
  unverified: { label: string; anchor: string }[];
};

const STATUSES: ItineraryStatus[] = ["draft", "sent", "confirmed", "lost"];

export function SharePanel({
  open,
  onClose,
  target,
  agencyName,
  onStatus,
  onShared,
  onJump,
}: {
  open: boolean;
  onClose: () => void;
  target: ShareTarget;
  agencyName: string;
  onStatus: (s: ItineraryStatus) => void;
  onShared: () => void;
  onJump?: (anchor: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [share, setShare] = useState<ShareState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pdf, setPdf] = useState<PdfJobState | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let live = true;
    setError(null);
    void openShare(target.id).then((r) => {
      if (!live) return;
      if (r.ok) setShare(r.data);
      else setError(r.message);
    });
    return () => {
      live = false;
    };
  }, [open, target.id]);

  const defaultMessage = share
    ? agentShareMessage({
        clientName: target.clientName,
        destination: target.destination,
        agency: agencyName,
        link: share.url,
      })
    : "";
  const text = message ?? defaultMessage;

  const toggle = async (next: boolean) => {
    if (!share) return;
    setShare({ ...share, enabled: next });
    const r = await setLinkEnabled(target.id, next);
    if (r.ok) setShare(r.data);
    else {
      setShare({ ...share, enabled: !next });
      setError(r.message);
    }
  };

  const copy = async () => {
    if (!share) return;
    try {
      await navigator.clipboard.writeText(share.url);
    } catch {
      /* clipboard blocked: the field is selectable */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onShared();
  };

  // ── PDF ──
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedRef = useRef(0);
  const poll = useCallback((id: string) => {
    pollRef.current = setTimeout(async () => {
      setElapsed(Math.round((Date.now() - startedRef.current) / 1000));
      const r = await getPdfJob(id);
      if (!r.ok) {
        setPdf(null);
        setPdfError(r.message);
        return;
      }
      setPdf(r.data);
      if (r.data.status === "done") {
        window.location.assign(`/api/pdf/${r.data.id}`);
        return;
      }
      if (r.data.status === "failed") {
        setPdfError(r.data.error ?? "The PDF could not be prepared. Please try again.");
        return;
      }
      poll(id);
    }, 1000);
  }, []);
  useEffect(() => () => void (pollRef.current && clearTimeout(pollRef.current)), []);

  const downloadPdf = async () => {
    setPdfError(null);
    setElapsed(0);
    startedRef.current = Date.now();
    setPdf({ id: "", status: "queued", pages: null, bytes: null, error: null });
    const r = await requestPdf(target.id);
    if (!r.ok) {
      setPdf(null);
      setPdfError(r.message);
      return;
    }
    setPdf(r.data);
    onShared();
    poll(r.data.id);
  };
  const preparing = pdf && (pdf.status === "queued" || pdf.status === "rendering");

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-label="Share itinerary"
      className={cn(
        "border-line bg-surface-raised text-ink shadow-float backdrop:bg-scrim border p-0",
        // Phones: bottom sheet. md+: right panel (PNG 14).
        "mx-0 mt-auto mb-0 max-h-[92dvh] w-full max-w-none rounded-t-lg",
        "md:my-2 md:mr-2 md:ml-auto md:h-[calc(100dvh-16px)] md:max-h-none md:w-[420px] md:rounded-lg",
      )}
    >
      {open && (
        <div className="flex h-full flex-col">
          <div className="border-line flex items-center justify-between border-b px-6 py-4">
            <h2 className="text-heading-2">Share itinerary</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="focus-ring text-ink-secondary hover:text-ink -mr-2 grid size-9 place-items-center rounded-md"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Link */}
            <section className="border-line border-b px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-heading-3">Link sharing</div>
                  <div className="text-body-sm text-ink-secondary">
                    {share?.enabled === false
                      ? "Off. The link shows a friendly page with your contact details."
                      : "Anyone with the link can view"}
                  </div>
                </div>
                <Switch
                  label="Link sharing"
                  checked={share?.enabled ?? true}
                  onChange={(v) => void toggle(v)}
                  className="mt-1"
                />
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  readOnly
                  value={share?.url ?? "Creating link…"}
                  onFocus={(e) => e.currentTarget.select()}
                  aria-label="Share link"
                  className={cn(
                    "border-line bg-surface text-body-sm text-ink-secondary h-10 min-w-0 flex-1 rounded-md border px-3",
                    share?.enabled === false && "line-through",
                  )}
                />
                <Button
                  variant="secondary"
                  className="h-10 w-[104px]"
                  onClick={() => void copy()}
                  disabled={!share || !share.enabled}
                >
                  {copied ? (
                    <>
                      <Check aria-hidden /> Copied
                    </>
                  ) : (
                    "Copy link"
                  )}
                </Button>
              </div>
              {error ? <p className="text-body-sm text-danger mt-2">{error}</p> : null}
            </section>

            {/* Send */}
            <section className="border-line border-b px-6 py-5">
              <div className="text-label text-ink-secondary">Send</div>
              <a
                href={share && share.enabled ? waHref(target.clientPhone, text) : undefined}
                target="_blank"
                rel="noopener noreferrer"
                aria-disabled={!share || !share.enabled}
                onClick={(e) => {
                  if (!share || !share.enabled) e.preventDefault();
                  else onShared();
                }}
                className={cn(
                  "focus-ring bg-indigo text-on-indigo hover:bg-indigo-hover text-button mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-md",
                  (!share || !share.enabled) && "pointer-events-none opacity-50",
                )}
              >
                <MessageCircle className="size-4" aria-hidden /> Share on WhatsApp
              </a>
              {editing ? (
                <textarea
                  value={text}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  aria-label="WhatsApp message"
                  className="border-line-strong bg-surface text-body-sm mt-3 w-full rounded-md border px-3 py-2"
                />
              ) : (
                <p className="text-body-sm text-ink-secondary mt-2">
                  Opens WhatsApp{target.clientPhone ? ` for ${target.clientPhone}` : ""} with: “
                  {text.length > 90 ? `${text.slice(0, 90)}…` : text}”{" "}
                </p>
              )}
              <button
                type="button"
                onClick={() => setEditing((v) => !v)}
                className="text-body-sm text-indigo mt-1 underline underline-offset-2"
              >
                {editing ? "Done" : "Edit message"}
              </button>

              {/* PDF */}
              <div className="border-line mt-4 rounded-md border px-4 py-3">
                {preparing ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-heading-3 flex items-center gap-2">
                        <FileText className="size-4" aria-hidden /> Preparing PDF…
                      </span>
                      <span className="text-caption text-ink-muted tnum">{elapsed} s</span>
                    </div>
                    <div className="bg-line mt-2 h-0.5 overflow-hidden rounded-full">
                      <div
                        className="bg-indigo h-full transition-[width] duration-1000"
                        style={{ width: `${Math.min(92, 8 + elapsed * 9)}%` }}
                      />
                    </div>
                    <p className="text-caption text-ink-secondary mt-2">
                      Download starts on its own. {target.dayCount} days.
                    </p>
                  </>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-body-sm text-ink-secondary">
                      {pdf?.status === "done"
                        ? `Downloaded · ${pdf.pages ?? "?"} pages${pdf.bytes ? ` · ${(pdf.bytes / 1_048_576).toFixed(1)} MB` : ""}`
                        : "A4 PDF with your branding"}
                    </span>
                    <Button variant="secondary" size="sm" onClick={() => void downloadPdf()}>
                      <FileText aria-hidden /> Download PDF
                    </Button>
                  </div>
                )}
                {pdfError ? <p className="text-body-sm text-danger mt-2">{pdfError}</p> : null}
              </div>
            </section>

            {/* Activity (views counted once per hour per device; no scroll tracking) */}
            <section className="border-line border-b px-6 py-5">
              <div className="text-label text-ink-secondary">Client activity</div>
              {share && share.viewCount > 0 ? (
                <div className="mt-3 grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-heading-1 tnum">{share.viewCount}</div>
                    <div className="text-body-sm text-ink-secondary">
                      {share.viewCount === 1 ? "view" : "views"} since{" "}
                      {formatDate(share.createdAt).split(" ").slice(0, 2).join(" ")}
                    </div>
                  </div>
                  {share.lastViewedAt ? (
                    <div>
                      <div className="text-heading-2 mt-1.5">{relativeDay(share.lastViewedAt)}</div>
                      <div className="text-body-sm text-ink-secondary">
                        last viewed{share.lastViewedDevice ? `, on ${share.lastViewedDevice}` : ""}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="text-body-sm text-ink-secondary mt-2">
                  Not opened yet. Views from link previews and bots are not counted.
                </p>
              )}
            </section>

            {/* Status */}
            <section className="border-line border-b px-6 py-5">
              <div className="text-label text-ink-secondary">Status</div>
              <div role="radiogroup" aria-label="Status" className="mt-3 grid grid-cols-2 gap-2">
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={target.status === s}
                    onClick={() => onStatus(s)}
                    className={cn(
                      "focus-ring flex h-12 items-center gap-3 rounded-md border px-3 text-left",
                      target.status === s ? "border-indigo bg-indigo-soft/40" : "border-line",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "grid size-4 place-items-center rounded-full border",
                        target.status === s ? "border-indigo" : "border-line-strong",
                      )}
                    >
                      {target.status === s ? (
                        <span className="bg-indigo size-2 rounded-full" />
                      ) : null}
                    </span>
                    <StatusDot status={s} />
                  </button>
                ))}
              </div>
            </section>

            {target.unverified.length ? (
              <section className="px-6 py-5">
                <div className="bg-amber-soft text-amber text-body-sm rounded-md px-4 py-3">
                  {target.unverified.length === 1
                    ? "1 hotel is"
                    : `${target.unverified.length} hotels are`}{" "}
                  not verified:{" "}
                  {target.unverified.map((u, i) => (
                    <span key={u.anchor}>
                      {i ? ", " : ""}
                      <button
                        type="button"
                        className="underline underline-offset-2"
                        onClick={() => {
                          onClose();
                          onJump?.(u.anchor);
                        }}
                      >
                        {u.label}
                      </button>
                    </span>
                  ))}
                  . The client will still see {target.unverified.length === 1 ? "it" : "them"}.
                </div>
              </section>
            ) : null}
          </div>
        </div>
      )}
    </dialog>
  );
}
