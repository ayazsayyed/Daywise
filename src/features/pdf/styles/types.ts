import type { ReactNode } from "react";

import type { PdfTokens } from "../tokens";
import type { PdfView } from "../view";
import type { StyleMeta } from "./meta";

export type StyleProps = { view: PdfView; tokens: PdfTokens };

/** React side of a style. Every surface is drawn by code from tokens + itinerary data. */
export type StyleComponents = {
  /** The cover: exactly one A4 page, laid out in mm. */
  Cover: (p: StyleProps) => ReactNode;
  /** Fixed page furniture repeated on every body and last page. */
  Chrome: (p: StyleProps & { part: "body" | "last" }) => ReactNode;
  /** Last part content (price, terms, contact, captions, credits). */
  Last: (p: StyleProps) => ReactNode;
  /** Extra CSS for this style, from tokens. */
  css?: (t: PdfTokens) => string;
};

/**
 * A PDF style (DESIGN.md Part 2 "PDF styles"): metadata + components. The
 * worker prints three documents (cover, body, last), merges them with pdf-lib
 * and stamps page numbers where `stamp` says; Editorial prints the original
 * single document.
 */
export type PdfStyle = StyleMeta & StyleComponents;
