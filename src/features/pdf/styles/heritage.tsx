import { ContactTable, LogoTile } from "@/features/share/parts";

import { mix } from "../tokens";
import { Captions, LineIcon, LogoLockup, titleFamily, titleSizePt } from "./shared";
import type { StyleComponents, StyleProps } from "./types";

/**
 * Heritage (modelled on docs/reference/sktw/pdf-template/cover-reference.png):
 * a deep primary band with a soft vignette (or the tenant's backdrop), an
 * accent-ruled title block, a slanted two-photo band bleeding into cream,
 * meta cells with line icons, and primary header/footer chrome inside.
 * All shapes are inline SVG; the only image besides photos is the backdrop.
 */

const W = 210;
const H = 297;

// Photo band geometry (mm). Top edge rises ~5° to the right, bottom edge ~6.5°.
const TOP = { l: 126, r: 108 };
const BOT = { l: 224, r: 200 };
const yTop = (x: number) => TOP.l + ((TOP.r - TOP.l) * x) / W;
const yBot = (x: number) => BOT.l + ((BOT.r - BOT.l) * x) / W;
const DIV = { top: 120, bot: 86 }; // x where the diagonal divider meets each edge

const GROUNDS = ["#D9D2C5", "#CDD1D8"];

function Cover({ view, tokens }: StyleProps) {
  const s = view.share;
  const title = s.title;
  const titlePt = titleSizePt(title, 72);
  const light = mix(tokens.primary, "#FFFFFF", 0.16);
  const dark = mix(tokens.primary, "#000000", 0.35);
  const photos = view.coverPhotos.slice(0, 2);
  const leftPoly = `0,${TOP.l} ${DIV.top},${yTop(DIV.top)} ${DIV.bot},${yBot(DIV.bot)} 0,${BOT.l}`;
  const rightPoly = `${DIV.top},${yTop(DIV.top)} ${W},${TOP.r} ${W},${BOT.r} ${DIV.bot},${yBot(DIV.bot)}`;
  const route = view.routeCities.slice(0, 5);
  const coverCredits = photos.map((p) => p.credit).filter(Boolean);

  return (
    <div
      className="pdf-sheet relative overflow-hidden"
      style={{ width: `${W}mm`, height: `${H}mm` }}
    >
      <svg
        className="absolute inset-0"
        width={`${W}mm`}
        height={`${H}mm`}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        aria-hidden
      >
        <defs>
          <radialGradient id="hv" cx="0.78" cy="0.22" r="0.85">
            <stop offset="0" stopColor={light} />
            <stop offset="0.55" stopColor={tokens.primary} />
            <stop offset="1" stopColor={dark} />
          </radialGradient>
          <clipPath id="hl">
            <polygon points={leftPoly} />
          </clipPath>
          <clipPath id="hr">
            <polygon points={rightPoly} />
          </clipPath>
        </defs>
        {tokens.backdropUrl ? (
          <image
            href={tokens.backdropUrl}
            x="0"
            y="0"
            width={W}
            height={H}
            preserveAspectRatio="xMidYMid slice"
          />
        ) : (
          <rect x="0" y="0" width={W} height={H} fill="url(#hv)" />
        )}
        {[leftPoly, rightPoly].map((poly, i) => {
          const p = photos[i];
          return (
            <g key={i} clipPath={`url(#${i === 0 ? "hl" : "hr"})`}>
              <polygon points={poly} fill={GROUNDS[i]} />
              {p ? (
                <image
                  href={p.url}
                  x={i === 0 ? 0 : DIV.bot}
                  y={i === 0 ? yTop(DIV.top) : TOP.r}
                  width={i === 0 ? DIV.top : W - DIV.bot}
                  height={i === 0 ? BOT.l - yTop(DIV.top) : yBot(DIV.bot) - TOP.r}
                  preserveAspectRatio="xMidYMid slice"
                />
              ) : (
                <text
                  x={i === 0 ? 8 : DIV.top + 6}
                  y={i === 0 ? BOT.l - 30 : BOT.r - 12}
                  fontSize="3.6"
                  fill="#5E5B55"
                  fontFamily="Inter, sans-serif"
                >
                  {view.routeCities[i] ?? view.routeCities[0] ?? title}
                </text>
              )}
            </g>
          );
        })}
        {/* Cream surface the band bleeds into, and the footer strip. */}
        <polygon points={`0,${BOT.l} ${W},${BOT.r} ${W},277 0,277`} fill={tokens.cream} />
        <rect x="0" y="277" width={W} height="20" fill={tokens.primary} />
        <g stroke={tokens.accent} strokeWidth="0.55" fill="none">
          <line x1="0" y1={TOP.l} x2={W} y2={TOP.r} />
          <line x1={DIV.top} y1={yTop(DIV.top)} x2={DIV.bot} y2={yBot(DIV.bot)} />
          <line x1="0" y1={BOT.l} x2={W} y2={BOT.r} />
          <line x1="0" y1="277" x2={W} y2="277" />
        </g>
      </svg>

      {/* Top row */}
      <div
        className="absolute flex items-center"
        style={{ left: "18mm", top: "11mm", height: "16mm" }}
      >
        <LogoLockup
          view={view}
          tokens={tokens}
          color={tokens.coverText}
          secondary={tokens.coverTextSecondary}
          size={40}
        />
      </div>
      <div
        className="absolute"
        style={{
          left: "92mm",
          top: "11mm",
          width: "0.35mm",
          height: "16mm",
          background: tokens.accentOnPrimary,
        }}
      />
      <div
        className="absolute text-[8pt] font-medium uppercase"
        style={{ left: "99mm", top: "17mm", letterSpacing: "0.3em", color: tokens.coverText }}
      >
        Private travel itinerary <Dot color={tokens.accentOnPrimary} /> {view.year}
      </div>

      {/* Title block */}
      <div className="absolute flex flex-col" style={{ left: "18mm", top: "38mm", width: "160mm" }}>
        <div
          className="text-[9.5pt] font-medium uppercase"
          style={{ letterSpacing: "0.32em", color: tokens.accentOnPrimary }}
        >
          {view.eyebrow}
        </div>
        <h1
          className="mt-[2.5mm] leading-[1.02] font-semibold"
          style={{
            fontSize: `${titlePt}pt`,
            color: tokens.coverText,
            fontFamily: titleFamily(tokens.titleFont),
            letterSpacing: tokens.titleFont === "serif" ? "-0.01em" : "-0.025em",
          }}
        >
          {title}
        </h1>
        <svg width="72mm" height="5mm" viewBox="0 0 72 5" className="mt-[1.5mm]" aria-hidden>
          <path d="M1 4 Q36 -1.5 71 3.4" stroke={tokens.accent} strokeWidth="0.6" fill="none" />
        </svg>
        {view.preparedLine ? (
          <p className="mt-[3mm] text-[13pt]" style={{ color: tokens.coverText }}>
            Prepared especially for <span className="font-semibold">{view.clientName}</span>
          </p>
        ) : null}
        {route.length ? (
          <div className="mt-[5mm] flex items-center gap-[3mm]" style={{ color: tokens.coverText }}>
            <span style={{ width: "14mm", height: "0.3mm", background: tokens.accent }} />
            <span
              className="truncate text-[9pt] font-medium uppercase"
              style={{ letterSpacing: "0.26em", maxWidth: "140mm" }}
            >
              {route.join(" — ")}
            </span>
            <span style={{ width: "14mm", height: "0.3mm", background: tokens.accent }} />
          </div>
        ) : null}
      </div>

      {coverCredits.length ? (
        <p
          className="absolute text-right text-[9pt] leading-tight"
          style={{ right: "14mm", top: "215mm", width: "100mm", color: tokens.inkSecondary }}
        >
          {coverCredits.join(" · ")}
        </p>
      ) : null}

      {/* Meta cells on cream */}
      <div
        className="absolute grid grid-cols-3"
        style={{ left: "16mm", right: "16mm", top: "228mm", color: tokens.ink }}
      >
        {[
          {
            icon: "calendar" as const,
            label: "Travel dates",
            value: view.dates ?? "Dates to confirm",
          },
          { icon: "bed" as const, label: "Duration", value: view.duration },
          { icon: "people" as const, label: "Travellers", value: view.travellers },
        ].map((m, i) => (
          <div
            key={m.label}
            className="flex items-start gap-[3mm] px-[4mm]"
            style={{ borderLeft: i ? `0.3mm solid ${tokens.accentOnPaper}` : undefined }}
          >
            <LineIcon name={m.icon} color={tokens.accentOnPaper} size="7mm" />
            <div className="min-w-0">
              <div
                className="text-[7.5pt] font-medium uppercase"
                style={{ letterSpacing: "0.18em", color: tokens.inkSecondary }}
              >
                {m.label}
              </div>
              <div className="text-[12.5pt] leading-tight font-semibold">{m.value}</div>
            </div>
          </div>
        ))}
      </div>
      <div
        className="absolute"
        style={{
          left: "18mm",
          right: "18mm",
          top: "250mm",
          height: "0.3mm",
          background: tokens.accentOnPaper,
        }}
      />
      {view.share.summary ? (
        <p
          className="absolute line-clamp-3 text-[11pt] leading-[1.45] italic"
          style={{ left: "18mm", right: "18mm", top: "254mm", color: tokens.inkSecondary }}
        >
          {view.share.summary}
        </p>
      ) : null}

      {/* Footer strip */}
      <div
        className="absolute flex items-center justify-between text-[7.5pt] uppercase"
        style={{
          left: "14mm",
          right: "12mm",
          top: "277mm",
          height: "20mm",
          color: tokens.onPrimary,
          letterSpacing: "0.14em",
        }}
      >
        <span className="truncate" style={{ maxWidth: "128mm" }}>
          {s.agency.name}
          {s.agency.tagline ? (
            <>
              {" "}
              <Dot color={tokens.accentOnPrimary} /> {s.agency.tagline}
            </>
          ) : null}
        </span>
        <span
          className="flex items-center gap-[4mm] normal-case"
          style={{ letterSpacing: "0.02em" }}
        >
          {s.agency.website ? <span className="text-[9pt]">{s.agency.website}</span> : null}
          <span style={{ width: "0.3mm", height: "6mm", background: tokens.accentOnPrimary }} />
          <span className="text-[9pt]">01</span>
        </span>
      </div>
    </div>
  );
}

function Chrome({ view, tokens }: StyleProps & { part: "body" | "last" }) {
  const light = mix(tokens.primary, "#FFFFFF", 0.14);
  return (
    <div className="pdf-chrome" aria-hidden>
      <div
        className="fixed inset-0"
        style={{ width: `${W}mm`, height: `${H}mm`, background: tokens.cream, zIndex: -2 }}
      />
      <svg
        className="fixed top-0 left-0"
        style={{ zIndex: -1 }}
        width={`${W}mm`}
        height="42mm"
        viewBox={`0 0 ${W} 42`}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="hh" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor={tokens.primary} />
            <stop offset="1" stopColor={light} />
          </linearGradient>
        </defs>
        <path d="M0 0 H210 V30 C176 41 138 22 92 25 C54 27 22 32 0 34 Z" fill="url(#hh)" />
        <path
          d="M0 34 C22 32 54 27 92 25 C138 22 176 41 210 30"
          stroke={tokens.accent}
          strokeWidth="0.6"
          fill="none"
        />
      </svg>
      <div className="fixed flex items-center" style={{ left: "16mm", top: "6mm", height: "14mm" }}>
        <LogoLockup
          view={view}
          tokens={tokens}
          color={tokens.onPrimary}
          secondary={tokens.onPrimarySecondary}
          size={30}
        />
      </div>
      <div
        className="fixed"
        style={{
          left: "86mm",
          top: "7mm",
          width: "0.35mm",
          height: "12mm",
          background: tokens.accentOnPrimary,
        }}
      />
      <div
        className="fixed text-[7.5pt] font-medium uppercase"
        style={{
          left: "92mm",
          top: "11.5mm",
          letterSpacing: "0.3em",
          color: tokens.onPrimary,
        }}
      >
        Private travel itinerary <Dot color={tokens.accentOnPrimary} /> {view.year}
      </div>
      <div
        className="fixed flex items-center text-[9pt]"
        style={{
          left: 0,
          top: "284mm",
          width: `${W}mm`,
          height: "13mm",
          padding: "0 16mm",
          background: tokens.primary,
          borderTop: `0.5mm solid ${tokens.accent}`,
          color: tokens.onPrimary,
        }}
      >
        <span className="truncate" style={{ maxWidth: "140mm" }}>
          {view.share.agency.name} · {view.share.footerTitle}
        </span>
      </div>
    </div>
  );
}

function Last({ view, tokens }: StyleProps) {
  const s = view.share;
  const price = s.price;
  const panel = mix(tokens.cream, tokens.primary, 0.06);
  return (
    <div className="flex flex-col gap-[7mm]" style={{ color: tokens.ink }}>
      <div className="share-terms">
        <h2
          className="text-[28pt] leading-tight font-semibold"
          style={{ fontFamily: titleFamily(tokens.titleFont) }}
        >
          {price ? "Price and terms" : "Inclusions and terms"}
        </h2>
        <svg width="60mm" height="4mm" viewBox="0 0 60 4" aria-hidden>
          <path
            d="M1 3.2 Q30 -1 59 2.6"
            stroke={tokens.accentOnPaper}
            strokeWidth="0.6"
            fill="none"
          />
        </svg>
      </div>

      {price ? (
        <div className="share-price flex flex-wrap items-end gap-[8mm]">
          <div
            className="relative overflow-hidden rounded-[3mm]"
            style={{ background: tokens.primary, padding: "5mm 14mm 5mm 7mm", minWidth: "80mm" }}
          >
            <div
              className="absolute top-0 right-0"
              style={{
                width: "12mm",
                height: "12mm",
                background: tokens.accent,
                clipPath: "polygon(100% 0, 0 0, 100% 100%)",
              }}
            />
            <div
              className="text-[8pt] font-semibold uppercase"
              style={{ letterSpacing: "0.3em", color: tokens.accentOnPrimary }}
            >
              Price
            </div>
            <div
              className="tnum text-[26pt] leading-tight font-semibold"
              style={{ color: tokens.onPrimary }}
            >
              {price.total ?? price.amount}
            </div>
            <div className="text-[10.5pt]" style={{ color: tokens.onPrimarySecondary }}>
              {price.total ? price.totalLabel : price.unitLine}
            </div>
          </div>
          {price.lines.length || price.taxNote ? (
            <div className="min-w-[60mm] flex-1 text-[10.5pt]">
              {price.lines.map((l) => (
                <div
                  key={l.label}
                  className="flex justify-between gap-[4mm] border-b py-[1.5mm]"
                  style={{ borderColor: "#E2DED6" }}
                >
                  <span style={{ color: tokens.inkSecondary }}>{l.label}</span>
                  <span className="tnum">{l.amount}</span>
                </div>
              ))}
              {price.taxNote ? (
                <p className="pt-[2mm] text-[9pt]" style={{ color: tokens.inkSecondary }}>
                  {price.taxNote}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="share-sections grid grid-cols-2 gap-x-[10mm] gap-y-[7mm]">
        {[
          { title: "Included", icon: "check" as const, items: s.sections.included },
          { title: "Not included", icon: "cross" as const, items: s.sections.excluded },
        ].map((col) =>
          col.items.length ? (
            <div key={col.title} className="break-inside-avoid">
              <Heading icon={col.icon} title={col.title} tokens={tokens} />
              <ul className="mt-[3mm] space-y-[1.5mm] text-[10.5pt] leading-[1.45]">
                {col.items.map((it, i) => (
                  <li key={i} className="flex gap-[2.5mm]">
                    <span
                      className="mt-[2mm] shrink-0 rounded-full"
                      style={{ width: "1.4mm", height: "1.4mm", background: tokens.accentOnPaper }}
                    />
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div key={col.title} />
          ),
        )}
        {s.sections.payment ? (
          <div className="break-inside-avoid">
            <Heading icon="card" title="Payment" tokens={tokens} />
            <p className="mt-[3mm] text-[10.5pt] leading-[1.45] whitespace-pre-line">
              {s.sections.payment}
            </p>
          </div>
        ) : null}
        {s.sections.cancellation ? (
          <div className="break-inside-avoid">
            <Heading icon="clock" title="Cancellation" tokens={tokens} />
            <p className="mt-[3mm] text-[10.5pt] leading-[1.45] whitespace-pre-line">
              {s.sections.cancellation}
            </p>
          </div>
        ) : null}
      </div>

      <div
        className="share-footer grid grid-cols-[minmax(0,1fr)_minmax(0,1.9fr)] gap-[7mm] rounded-[3mm] p-[6mm]"
        style={{ background: panel, breakInside: "avoid" }}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-[4mm]">
            <LogoTile agency={s.agency} size={46} />
            <div
              className="line-clamp-2 min-w-0 leading-tight font-semibold"
              style={{
                fontFamily: titleFamily(tokens.titleFont),
                fontSize: s.agency.name.length > 28 ? "12pt" : "15pt",
              }}
            >
              {s.agency.name}
            </div>
          </div>
          {s.agency.footer ? (
            <p
              className="mt-[4mm] text-[10pt] leading-[1.45]"
              style={{ color: tokens.inkSecondary }}
            >
              {s.agency.footer}
            </p>
          ) : null}
        </div>
        <div className="share-contacts min-w-0 text-[10pt]">
          <ContactTable agency={s.agency} />
        </div>
      </div>

      <div
        className="border-t pt-[3mm]"
        style={{ borderColor: tokens.accentOnPaper, breakInside: "avoid" }}
      >
        <Captions view={view} tokens={tokens} />
      </div>
    </div>
  );
}

function Heading({
  icon,
  title,
  tokens,
}: {
  icon: "check" | "cross" | "card" | "clock";
  title: string;
  tokens: StyleProps["tokens"];
}) {
  return (
    <div className="flex items-center gap-[3mm]">
      <LineIcon name={icon} color={tokens.accentOnPaper} size="6mm" />
      <h3 className="text-[10pt] font-semibold uppercase" style={{ letterSpacing: "0.2em" }}>
        {title}
      </h3>
      <span className="h-[0.3mm] flex-1" style={{ background: tokens.accentOnPaper }} />
    </div>
  );
}

/** Small accent bullet used between letterspaced labels ("PRIVATE TRAVEL ITINERARY • 2026"). */
function Dot({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className="mx-[1.5mm] inline-block rounded-full align-middle"
      style={{ width: "1.1mm", height: "1.1mm", background: color }}
    />
  );
}

export const heritage: StyleComponents = { Cover, Chrome, Last };
