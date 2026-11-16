"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { FileText, Upload } from "lucide-react";

import { SectionLabel, SegmentedControl } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getPdfJob } from "@/features/share/actions";
import { DaySection } from "@/features/share/share-page";
import { isHex } from "@/lib/color";
import { cn } from "@/lib/utils";

import { previewPdf, removeBackdrop, uploadBackdrop, type BackdropState } from "./actions";
import { A4_MM, BACKDROP_MAX_BYTES, BACKDROP_MIN_PX, PX_PER_MM, type TitleFont } from "./constants";
import { componentsFor } from "./styles";
import type { StyleMeta } from "./styles/meta";
import { buildTokens, deriveAccent, MIN_BACKDROP_CONTRAST } from "./tokens";
import type { PdfView } from "./view";

export type PdfBrandValue = { pdf_style: string; accent_color: string; title_font: TitleFont };

export type BackdropInfo = {
  url: string;
  w: number;
  h: number;
  text: "light" | "dark";
  contrast: number;
} | null;

/**
 * Settings → PDF (DESIGN.md Part 2 "PDF styles"): style, accent, title font
 * and the optional backdrop. Saved with the rest of Settings ("Save changes");
 * the backdrop uploads on its own, like the logo.
 */
export function PdfBrandFields({
  value,
  onChange,
  styles,
  themeColor,
  backdrop,
}: {
  value: PdfBrandValue;
  onChange: (next: Partial<PdfBrandValue>) => void;
  styles: StyleMeta[];
  themeColor: string;
  backdrop: BackdropInfo;
}) {
  const style = styles.find((s) => s.id === value.pdf_style) ?? styles[0]!;
  const derived = isHex(themeColor) ? deriveAccent(themeColor) : "#C9A227";
  const accentValid = !value.accent_color || isHex(value.accent_color);
  const [upload, uploadAction, uploading] = useActionState<BackdropState, FormData>(
    uploadBackdrop,
    {
      status: "idle",
    },
  );
  const [removing, startRemove] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const contrast = upload.status === "uploaded" ? upload.contrast : (backdrop?.contrast ?? null);

  return (
    <>
      <input type="hidden" name="pdf_style" value={value.pdf_style} />
      <input type="hidden" name="title_font" value={value.title_font} />

      <div className="flex flex-col gap-2">
        <SectionLabel as="span" id="pdf-style-label">
          PDF style
        </SectionLabel>
        <div
          role="radiogroup"
          aria-labelledby="pdf-style-label"
          className="grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-2"
        >
          {styles.map((s) => {
            const active = s.id === value.pdf_style;
            return (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onChange({ pdf_style: s.id })}
                className={cn(
                  "focus-ring bg-surface-raised flex flex-col gap-1 rounded-md border px-3.5 py-3 text-left",
                  active ? "border-indigo ring-indigo ring-1" : "border-line-strong",
                )}
              >
                <span className="text-heading-3 text-ink">{s.name}</span>
                <span className="text-caption text-ink-secondary">{s.description}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="accent_color" className="text-label text-ink-secondary">
          Accent colour
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <span
            aria-hidden
            className="border-line size-9 rounded-md border"
            style={{
              backgroundColor: accentValid && value.accent_color ? value.accent_color : derived,
            }}
          />
          <Input
            id="accent_color"
            name="accent_color"
            value={value.accent_color}
            onChange={(e) => onChange({ accent_color: e.target.value.toUpperCase() })}
            placeholder={derived}
            className="tnum w-[120px] uppercase"
            aria-invalid={!accentValid || undefined}
            spellCheck={false}
            maxLength={7}
          />
          {value.accent_color ? (
            <button
              type="button"
              onClick={() => onChange({ accent_color: "" })}
              className="focus-ring text-body-sm text-ink-secondary hover:text-ink rounded-sm"
            >
              Use suggested
            </button>
          ) : null}
        </div>
        <p className={cn("text-caption", accentValid ? "text-ink-muted" : "text-danger")}>
          {accentValid
            ? `Rules, eyebrows and day numbers in the PDF. Leave empty for ${derived}, suggested from your theme colour. Text that would be hard to read is adjusted automatically.`
            : "Use a 6-digit hex like #C9A227."}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-body-sm text-ink">Cover title font</span>
        <SegmentedControl
          ariaLabel="Cover title font"
          value={value.title_font}
          onChange={(v) => onChange({ title_font: v })}
          segments={[
            { value: "inter", label: "Inter" },
            { value: "serif", label: "Fraunces serif" },
          ]}
        />
      </div>

      <div className="flex flex-col gap-2">
        <SectionLabel>Cover backdrop</SectionLabel>
        {!style.supportsBackdrop ? (
          <p className="text-caption text-ink-muted">
            {style.name} does not use a backdrop.{" "}
            {styles.some((s) => s.supportsBackdrop)
              ? `Choose ${styles
                  .filter((s) => s.supportsBackdrop)
                  .map((s) => s.name)
                  .join(" or ")} to add one.`
              : null}
          </p>
        ) : (
          <div className="flex flex-wrap items-start gap-3">
            <div
              className="border-line bg-surface-sunken relative w-[64px] shrink-0 overflow-hidden rounded-md border"
              style={{ aspectRatio: "210 / 297" }}
            >
              {backdrop ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={backdrop.url}
                  alt=""
                  className="absolute inset-0 size-full object-cover"
                />
              ) : null}
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <div className="flex items-center gap-3">
                <input
                  ref={fileRef}
                  name="backdrop"
                  type="file"
                  accept="image/png,image/jpeg"
                  className="sr-only"
                  form="backdrop-upload"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    // Check before sending: an oversized body never reaches the action.
                    const problem =
                      f.size > BACKDROP_MAX_BYTES
                        ? `This file is ${(f.size / 1048576).toFixed(1)} MB; the limit is 8 MB. Export as JPG.`
                        : !["image/png", "image/jpeg"].includes(f.type)
                          ? "Only PNG or JPG images are accepted."
                          : null;
                    setLocalError(problem);
                    if (problem) {
                      e.target.value = "";
                      return;
                    }
                    e.target.form?.requestSubmit();
                  }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={uploading || removing}
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload aria-hidden />
                  {uploading ? "Uploading…" : backdrop ? "Replace" : "Upload"}
                </Button>
                {backdrop ? (
                  <button
                    type="button"
                    disabled={uploading || removing}
                    onClick={() => startRemove(() => removeBackdrop())}
                    className="focus-ring text-body-sm text-ink-secondary hover:text-ink disabled:text-ink-muted rounded-sm"
                  >
                    {removing ? "Removing…" : "Remove"}
                  </button>
                ) : null}
              </div>
              <p className="text-caption text-ink-muted tnum">
                {backdrop
                  ? `${backdrop.w} × ${backdrop.h} px · ${backdrop.text === "light" ? "light" : "dark"} cover text · ${backdrop.contrast.toFixed(1)}:1`
                  : `Optional. A4 portrait PNG or JPG, ${BACKDROP_MIN_PX.w} × ${BACKDROP_MIN_PX.h} px or larger, up to 8 MB. Replaces the band's colour behind the title.`}
              </p>
              {contrast !== null && contrast < MIN_BACKDROP_CONTRAST ? (
                <p className="text-caption text-amber" role="status">
                  Cover text will be hard to read on this image ({contrast.toFixed(1)}:1, needs
                  4.5:1). Use a darker or lighter image behind the title area.
                </p>
              ) : null}
              {localError || upload.status === "error" ? (
                <p className="text-caption text-danger" role="alert">
                  {localError ?? (upload.status === "error" ? upload.message : null)}
                </p>
              ) : null}
            </div>
          </div>
        )}
      </div>
      {/* Separate form so choosing a file uploads without submitting the settings. */}
      <BackdropForm action={uploadAction} />
    </>
  );
}

/**
 * The upload form lives at the end of <body> (forms cannot nest inside the
 * settings form); the file input joins it through its `form` attribute.
 */
function BackdropForm({ action }: { action: (fd: FormData) => void }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.body), []);
  return host
    ? createPortal(<form id="backdrop-upload" action={action} className="hidden" />, host)
    : null;
}

const SHEET_W = A4_MM.w * PX_PER_MM;

/** Live preview of the chosen style: cover, one inner page, last page, at A4 scaled to the column. */
export function PdfStylePreview({
  value,
  styles,
  themeColor,
  backdrop,
  sample,
}: {
  value: PdfBrandValue;
  styles: StyleMeta[];
  themeColor: string;
  backdrop: BackdropInfo;
  sample: PdfView;
}) {
  const [page, setPage] = useState<"cover" | "inner" | "last">("cover");
  const meta = styles.find((s) => s.id === value.pdf_style) ?? styles[0]!;
  const comps = componentsFor(meta);
  const tokens = useMemo(
    () =>
      buildTokens({
        primary: isHex(themeColor) ? themeColor : "#2E3A8C",
        accent: value.accent_color && isHex(value.accent_color) ? value.accent_color : null,
        titleFont: value.title_font,
        backdropUrl: meta.supportsBackdrop ? (backdrop?.url ?? null) : null,
        backdropText: backdrop?.text ?? null,
      }),
    [themeColor, value, meta.supportsBackdrop, backdrop],
  );
  const view = useMemo<PdfView>(
    () => ({
      ...sample,
      share: { ...sample.share, agency: { ...sample.share.agency, accent: themeColor } },
    }),
    [sample, themeColor],
  );
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setScale(e!.contentRect.width / SHEET_W));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const vars = {
    ["--pdf-accent-on-paper" as string]: tokens.accentOnPaper,
    ["--tenant-accent" as string]: tokens.primary,
    ["--color-tenant" as string]: tokens.primary,
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <SectionLabel>PDF preview</SectionLabel>
        <SegmentedControl
          ariaLabel="Preview page"
          value={page}
          onChange={setPage}
          segments={[
            { value: "cover", label: "Cover" },
            { value: "inner", label: "Inner" },
            { value: "last", label: "Last" },
          ]}
          className="h-8 [&>button]:px-2.5"
        />
      </div>
      <div
        ref={boxRef}
        className="pdf-preview border-line relative w-full overflow-hidden rounded-lg border bg-white"
        style={{ aspectRatio: `${A4_MM.w} / ${A4_MM.h}` }}
        aria-label={`${meta.name} ${page} page preview`}
        role="img"
      >
        {comps ? (
          <div
            className="pdf-root absolute top-0 left-0 origin-top-left"
            style={{
              width: `${A4_MM.w}mm`,
              height: `${A4_MM.h}mm`,
              transform: `scale(${scale})`,
              ...vars,
            }}
          >
            {page === "cover" ? (
              <comps.Cover view={view} tokens={tokens} />
            ) : (
              <div className="relative" style={{ width: `${A4_MM.w}mm`, height: `${A4_MM.h}mm` }}>
                <comps.Chrome
                  view={view}
                  tokens={tokens}
                  part={page === "inner" ? "body" : "last"}
                />
                <div
                  className="absolute overflow-hidden"
                  style={{
                    top: `${meta.insets.top}mm`,
                    left: `${meta.insets.left}mm`,
                    right: `${meta.insets.right}mm`,
                    bottom: `${meta.insets.bottom}mm`,
                    fontSize: "10.5pt",
                  }}
                >
                  {page === "inner" ? (
                    <DaySection day={view.share.days[1] ?? view.share.days[0]!} first print />
                  ) : (
                    <comps.Last view={view} tokens={tokens} />
                  )}
                </div>
                {meta.stamp ? (
                  <div
                    className="absolute text-[9pt]"
                    style={{
                      bottom: `${meta.stamp.bottomMm - 1}mm`,
                      ...(meta.stamp.align === "right"
                        ? { right: `${meta.stamp.sideMm}mm` }
                        : meta.stamp.align === "left"
                          ? { left: `${meta.stamp.sideMm}mm` }
                          : { left: 0, right: 0, textAlign: "center" as const }),
                      color: meta.stamp.color.startsWith("#")
                        ? meta.stamp.color
                        : ((tokens as unknown as Record<string, string>)[meta.stamp.color] ??
                          tokens.ink),
                    }}
                  >
                    {page === "inner" ? "Page 02 of 07" : "Page 07 of 07"}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        ) : null}
      </div>
      <p className="text-caption text-ink-muted">
        Sample Kashmir itinerary with your brand. Updates as you change settings; Preview PDF prints
        the real thing.
      </p>
      <PreviewPdfButton />
      {/* Chrome uses position: fixed in print; inside the preview it sits in the sheet. */}
      <style>{`.pdf-preview .fixed{position:absolute!important}.pdf-preview .share-day .text-tenant{color:var(--pdf-accent-on-paper)!important}`}</style>
    </div>
  );
}

function PreviewPdfButton() {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    const started = Date.now();
    setNote("Preparing PDF…");
    const r = await previewPdf();
    if (!r.ok) {
      setBusy(false);
      setNote(null);
      return setError(r.message);
    }
    for (;;) {
      await new Promise((res) => setTimeout(res, 1000));
      const j = await getPdfJob(r.data.id);
      if (j.ok && j.data.status === "done") {
        setBusy(false);
        setNote(`Ready · ${j.data.pages} pages`);
        window.location.assign(`/api/pdf/${j.data.id}`);
        return;
      }
      if (!j.ok || j.data.status === "failed" || Date.now() - started > 90_000) {
        setBusy(false);
        setNote(null);
        return setError(
          j.ok ? (j.data.error ?? "The PDF is taking too long. Please try again.") : j.message,
        );
      }
      setNote(`Preparing PDF… ${Math.round((Date.now() - started) / 1000)} s`);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <Button type="button" variant="secondary" onClick={run} disabled={busy}>
        <FileText aria-hidden />
        {busy ? "Preparing PDF…" : "Preview PDF"}
      </Button>
      <p className="text-caption text-ink-muted">
        {note ?? "Uses your saved settings. Not counted in your PDF limit."}
      </p>
      {error ? (
        <p className="text-caption text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
