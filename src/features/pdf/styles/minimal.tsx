import { LogoLockup, TermsContent, titleFamily, titleSizePt } from "./shared";
import type { StyleComponents, StyleProps } from "./types";

/** Minimal: a typographic cover on paper and thin header/footer lines. No backdrop. */

function Cover({ view, tokens }: StyleProps) {
  const s = view.share;
  return (
    <div className="pdf-sheet relative bg-white" style={{ width: "210mm", height: "297mm" }}>
      <div className="absolute" style={{ left: "20mm", right: "20mm", top: "18mm" }}>
        <LogoLockup
          view={view}
          tokens={tokens}
          color={tokens.ink}
          secondary={tokens.inkSecondary}
          size={34}
        />
      </div>
      <div
        className="absolute flex flex-col"
        style={{ left: "20mm", right: "20mm", top: "92mm", color: tokens.ink }}
      >
        <div
          className="text-[9pt] font-medium uppercase"
          style={{ letterSpacing: "0.28em", color: tokens.accentTextOnPaper }}
        >
          {view.eyebrow}
        </div>
        <div
          className="mt-[4mm]"
          style={{ width: "24mm", height: "0.5mm", background: tokens.accentOnPaper }}
        />
        <h1
          className="mt-[6mm] leading-[1.06] font-semibold"
          style={{
            fontSize: `${titleSizePt(s.title, 48)}pt`,
            fontFamily: titleFamily(tokens.titleFont),
            letterSpacing: "-0.02em",
          }}
        >
          {s.title}
        </h1>
        {view.preparedLine ? (
          <p className="mt-[5mm] text-[12pt]" style={{ color: tokens.inkSecondary }}>
            {view.preparedLine}
          </p>
        ) : null}
        <dl
          className="mt-[12mm] grid grid-cols-3 gap-[6mm] border-t pt-[5mm]"
          style={{ borderColor: "#E2DED6" }}
        >
          {[
            ["Travel dates", view.dates ?? "Dates to confirm"],
            ["Duration", view.duration],
            ["Travellers", view.travellers],
          ].map(([k, v]) => (
            <div key={k}>
              <dt
                className="text-[7.5pt] font-medium uppercase"
                style={{ letterSpacing: "0.16em", color: tokens.inkSecondary }}
              >
                {k}
              </dt>
              <dd className="mt-[1mm] text-[12pt] font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
        {view.routeCities.length ? (
          <p className="mt-[8mm] text-[10.5pt]" style={{ color: tokens.inkSecondary }}>
            {view.routeCities.join(" · ")}
          </p>
        ) : null}
        {s.summary ? (
          <p className="mt-[3mm] line-clamp-4 text-[11pt] leading-[1.5]">{s.summary}</p>
        ) : null}
      </div>
      <div
        className="absolute flex justify-between border-t pt-[2mm] text-[9pt]"
        style={{
          left: "20mm",
          right: "20mm",
          bottom: "14mm",
          borderColor: "#E2DED6",
          color: tokens.inkSecondary,
        }}
      >
        <span>{[s.agency.phone, s.agency.email].filter(Boolean).join(" · ")}</span>
        <span>{s.agency.website}</span>
      </div>
    </div>
  );
}

function Chrome({ view, tokens }: StyleProps & { part: "body" | "last" }) {
  return (
    <div aria-hidden>
      <div
        className="fixed flex justify-between border-b pb-[1.5mm] text-[9pt]"
        style={{
          left: "20mm",
          right: "20mm",
          top: "10mm",
          borderColor: "#E2DED6",
          color: tokens.inkSecondary,
        }}
      >
        <span className="truncate" style={{ maxWidth: "100mm" }}>
          {view.share.agency.name}
        </span>
        <span className="truncate" style={{ maxWidth: "70mm" }}>
          {view.share.footerTitle}
        </span>
      </div>
      <div
        className="fixed border-t"
        style={{ left: "20mm", right: "20mm", top: "283mm", borderColor: "#E2DED6" }}
      />
    </div>
  );
}

function Last(p: StyleProps) {
  return <TermsContent {...p} />;
}

export const minimal: StyleComponents = { Cover, Chrome, Last };
