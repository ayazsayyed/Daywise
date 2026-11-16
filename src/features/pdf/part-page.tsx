import { tenantStyle } from "@/features/share/parts";
import { DaySection } from "@/features/share/share-page";
import "@/features/share/share.css";

import { pdfSerif } from "./fonts";
import type { PrintPart } from "./geometry";
import { Flow } from "./styles/shared";
import type { PdfStyle } from "./styles";
import { tokenVars, type PdfTokens } from "./tokens";
import type { PdfView } from "./view";

/**
 * One print document of a generated PDF (cover, body or last). The worker
 * prints each with Chromium, keeps the cover's first page, merges the three
 * with pdf-lib and stamps page numbers. Page margin is 0: the style's chrome
 * bleeds to the sheet edge and `Flow` keeps content inside its insets.
 */
export function PdfPartPage({
  part,
  style,
  view,
  tokens,
}: {
  part: PrintPart;
  style: PdfStyle;
  view: PdfView;
  tokens: PdfTokens;
}) {
  const props = { view, tokens };
  const css = `@page{size:A4 portrait;margin:0}
html,body{margin:0!important;padding:0!important;background:transparent!important}
.pdf-root{position:relative;z-index:0;background:transparent!important}
.pdf-root .share-day:first-child{break-before:auto}
.pdf-root .share-day .text-tenant{color:var(--pdf-accent-on-paper)!important}
.pdf-root .share-hotel{background:#FFFFFF!important}
.pdf-root .share-stop-icon{color:var(--pdf-accent-on-paper)}
.pdf-sheet{break-after:avoid;break-inside:avoid}
${style.css?.(tokens) ?? ""}`;

  return (
    <div
      className={`share-root pdf-root text-ink ${pdfSerif.variable}`}
      data-print="1"
      data-pdf-style={style.id}
      data-pdf-part={part}
      style={{
        ...tenantStyle(tokens.primary),
        ...(tokenVars(tokens) as React.CSSProperties),
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: css }} />
      {part === "cover" ? (
        <style.Cover {...props} />
      ) : (
        <>
          <style.Chrome {...props} part={part} />
          <Flow insets={style.insets}>
            {part === "body" ? (
              view.share.days.map((d, i) => <DaySection key={d.n} day={d} first={i === 0} print />)
            ) : (
              <style.Last {...props} />
            )}
          </Flow>
        </>
      )}
    </div>
  );
}
