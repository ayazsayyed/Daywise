import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { after } from "next/server";

import { isPrintPart } from "@/features/pdf/geometry";
import { loadPdfByToken } from "@/features/pdf/load";
import { PdfPartPage } from "@/features/pdf/part-page";
import { loadShare } from "@/features/share/load";
import { validPrintSignature } from "@/features/share/print-sign";
import { SharePage } from "@/features/share/share-page";
import { DisabledState, UnavailableState } from "@/features/share/states";
import { clientIp, deviceOf, hourBucket, isBotUA, visitorHash } from "@/features/share/tracking";
import { recordShareView } from "@/lib/db/share";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ print?: string; sig?: string; part?: string }>;
};

/**
 * Public client page. The tenant comes from the share token only (CLAUDE.md);
 * nothing in the host, path or query picks a tenant. Always rendered fresh so
 * an edit or a disabled link shows on the next open. `?print=1` is the PDF
 * render: same page, print layout, never counted as a view.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const res = await loadShare(token);
  const robots = {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  };
  if (res.kind === "ok")
    return {
      title: { absolute: `${res.view.title} · ${res.view.agency.name}` },
      robots,
      referrer: "no-referrer",
    };
  if (res.kind === "disabled" || res.kind === "unavailable")
    return { title: { absolute: res.agency?.name ?? "Itinerary" }, robots };
  return { title: { absolute: "Itinerary" }, robots };
}

export default async function ShareRoute({ params, searchParams }: Props) {
  const [{ token }, sp] = await Promise.all([params, searchParams]);
  const print = sp.print === "1" && validPrintSignature(token, sp.sig, env.SESSION_SECRET);

  // Generated PDF styles: one of the three print documents (worker only, signed).
  if (print && isPrintPart(sp.part)) {
    const pdf = await loadPdfByToken(token);
    if (!pdf) notFound();
    return <PdfPartPage part={sp.part} style={pdf.style} view={pdf.view} tokens={pdf.tokens} />;
  }

  const res = await loadShare(token, print);

  if (res.kind === "not_found") notFound();
  if (res.kind === "disabled") return <DisabledState agency={res.agency} />;
  if (res.kind === "unavailable") return <UnavailableState agency={res.agency} />;

  if (!print) {
    const h = await headers();
    const ua = h.get("user-agent") ?? "";
    const purpose = `${h.get("purpose") ?? ""} ${h.get("sec-purpose") ?? ""} ${h.get("x-purpose") ?? ""}`;
    if (!isBotUA(ua) && !/prefetch|preview/i.test(purpose)) {
      const visitor = visitorHash(clientIp(h), ua, env.SESSION_SECRET);
      const linkId = res.linkId;
      after(() =>
        recordShareView(linkId, visitor, hourBucket(new Date()), deviceOf(ua)).catch((err) =>
          logger.warn({ err }, "share view not recorded"),
        ),
      );
    }
  }

  if (print) {
    // Editorial (single document): accent on rules and day numbers.
    const pdf = await loadPdfByToken(token);
    return <SharePage view={res.view} print pdfAccent={pdf?.tokens.accentOnPaper} />;
  }
  return <SharePage view={res.view} />;
}
