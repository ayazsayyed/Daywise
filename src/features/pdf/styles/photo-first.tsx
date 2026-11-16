import { LogoLockup, TermsContent, titleFamily, titleSizePt } from "./shared";
import type { StyleComponents, StyleProps } from "./types";

/**
 * Photo-first: the cover is one full-bleed hero photo with a bottom scrim and
 * the text block over it (an agreed PDF-only exception to "no text over
 * photos"); inner pages carry minimal chrome. No backdrop.
 */

function Cover({ view, tokens }: StyleProps) {
  const s = view.share;
  const hero = view.coverPhotos[0] ?? null;
  // Text sits on the scrim (photo) or on primary (no photo): both read white or ink per tokens.
  const text = hero ? "#FFFFFF" : tokens.onPrimary;
  const text2 = hero ? "#E9E4DA" : tokens.onPrimarySecondary;
  return (
    <div
      className="pdf-sheet relative overflow-hidden"
      style={{ width: "210mm", height: "297mm", background: tokens.primary }}
    >
      {hero ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={hero.url} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : null}
      {hero ? (
        <div
          className="absolute inset-x-0 bottom-0"
          style={{
            height: "62%",
            background:
              "linear-gradient(to bottom, rgba(20,18,16,0) 0%, rgba(20,18,16,0.55) 38%, rgba(20,18,16,0.86) 100%)",
          }}
        />
      ) : null}
      <div
        className="absolute flex flex-col"
        style={{ left: "16mm", right: "16mm", bottom: "18mm", color: text }}
      >
        <div
          className="text-[9pt] font-medium uppercase"
          style={{ letterSpacing: "0.3em", color: hero ? "#F3E3B5" : tokens.accentOnPrimary }}
        >
          {view.eyebrow}
        </div>
        <h1
          className="mt-[2mm] leading-[1.04] font-semibold"
          style={{
            fontSize: `${titleSizePt(s.title, 52)}pt`,
            fontFamily: titleFamily(tokens.titleFont),
          }}
        >
          {s.title}
        </h1>
        {view.preparedLine ? <p className="mt-[3mm] text-[12pt]">{view.preparedLine}</p> : null}
        <p className="mt-[2mm] text-[10.5pt]" style={{ color: text2 }}>
          {[view.dates, view.duration, view.travellers].filter(Boolean).join(" · ")}
        </p>
        {view.routeCities.length ? (
          <p className="mt-[1mm] truncate text-[10.5pt]" style={{ color: text2 }}>
            {view.routeCities.join(" · ")}
          </p>
        ) : null}
        <div
          className="mt-[8mm] flex items-end justify-between gap-[6mm] border-t pt-[4mm]"
          style={{ borderColor: "rgba(255,255,255,0.35)" }}
        >
          <LogoLockup view={view} tokens={tokens} color={text} secondary={text2} size={30} />
          {hero?.credit ? (
            <span className="max-w-[90mm] text-right text-[9pt]" style={{ color: text2 }}>
              {hero.credit}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Chrome({ view, tokens }: StyleProps & { part: "body" | "last" }) {
  return (
    <div aria-hidden>
      <div
        className="fixed"
        style={{
          left: "18mm",
          right: "18mm",
          top: "11mm",
          height: "0.5mm",
          background: tokens.accentOnPaper,
        }}
      />
      <div
        className="fixed flex justify-between text-[9pt]"
        style={{ left: "18mm", right: "18mm", top: "13mm", color: tokens.inkSecondary }}
      >
        <span className="truncate" style={{ maxWidth: "120mm" }}>
          {view.share.footerTitle}
        </span>
        <span className="truncate" style={{ maxWidth: "50mm" }}>
          {view.share.agency.name}
        </span>
      </div>
    </div>
  );
}

function Last(p: StyleProps) {
  return <TermsContent {...p} />;
}

export const photoFirst: StyleComponents = { Cover, Chrome, Last };
