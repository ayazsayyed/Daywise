import { Photo } from "@/features/share/parts";

import { LogoLockup, TermsContent, titleFamily, titleSizePt } from "./shared";
import type { StyleComponents, StyleProps } from "./types";

/**
 * Editorial: the original quiet PDF (DESIGN.md Part 2 "PDF", PNG 35–37), now
 * with accent on rules and day numbers. Printed through the original single
 * document, so page count and text match the pre-styles PDF exactly. These
 * components only draw the Settings preview of it.
 */

function Cover({ view, tokens }: StyleProps) {
  const s = view.share;
  return (
    <div
      className="pdf-sheet relative bg-white"
      style={{ width: "210mm", height: "297mm", padding: "15mm" }}
    >
      <div className="flex items-center justify-between pb-[4mm]">
        <LogoLockup
          view={view}
          tokens={tokens}
          color={s.agency.accent}
          secondary={tokens.inkSecondary}
        />
        <span className="text-[10.5pt]" style={{ color: tokens.inkSecondary }}>
          Itinerary · {s.printedOn}
        </span>
      </div>
      <div style={{ height: "0.3mm", background: tokens.accentOnPaper }} />
      {s.preparedFor ? (
        <p
          className="mt-[8mm] text-[8pt] font-medium uppercase"
          style={{ letterSpacing: "0.08em", color: tokens.inkSecondary }}
        >
          {s.preparedFor}
        </p>
      ) : null}
      <h1
        className="mt-[2mm] leading-[1.1] font-semibold"
        style={{
          fontSize: `${titleSizePt(s.title, 36)}pt`,
          color: tokens.ink,
          fontFamily: titleFamily(tokens.titleFont),
        }}
      >
        {s.title}
      </h1>
      <p className="mt-[2mm] text-[11pt]" style={{ color: tokens.inkSecondary }}>
        {s.meta}
      </p>
      <Photo
        image={view.coverPhotos[0] ?? s.cover}
        ratio="3:2"
        fallbackLabel={view.routeCities[0] ?? s.title}
        className="mt-[6mm]"
        eager
      />
      <div className="mt-[6mm] grid grid-cols-2 gap-[10mm] text-[10.5pt]">
        <div>
          <p>{s.summary}</p>
          <p className="mt-[2mm] text-[10pt]" style={{ color: tokens.inkSecondary }}>
            {s.route}
          </p>
        </div>
        <div>
          <div
            className="border-b pb-[2mm] text-[8pt] font-medium uppercase"
            style={{ color: tokens.inkSecondary, borderColor: "#E2DED6" }}
          >
            Where you stay
          </div>
          {s.days
            .filter((d) => d.hotel)
            .slice(0, 6)
            .map((d, i) => (
              <div
                key={d.n}
                className="grid grid-cols-[18mm_1fr] border-b py-[1.5mm]"
                style={{ borderColor: "#E2DED6" }}
              >
                <span style={{ color: tokens.inkSecondary }}>Night {i + 1}</span>
                <span>{d.hotel!.name}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

function Chrome({ view, tokens }: StyleProps & { part: "body" | "last" }) {
  return (
    <div
      className="fixed flex justify-between border-t text-[9pt]"
      style={{
        left: "15mm",
        right: "15mm",
        top: "284mm",
        paddingTop: "1.5mm",
        borderColor: "#E2DED6",
        color: tokens.inkSecondary,
      }}
      aria-hidden
    >
      <span>
        {view.share.agency.name} · {view.share.footerTitle}
      </span>
    </div>
  );
}

function Last(p: StyleProps) {
  return <TermsContent {...p} />;
}

export const editorial: StyleComponents = { Cover, Chrome, Last };
