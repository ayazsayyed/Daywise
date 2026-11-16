import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";

import { isPrintPart } from "@/features/pdf/geometry";
import { loadPdfPreview } from "@/features/pdf/load";
import { PdfPartPage } from "@/features/pdf/part-page";
import { validPrintSignature } from "@/features/share/print-sign";
import { SharePage } from "@/features/share/share-page";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "PDF preview", robots: { index: false, follow: false } };

type Props = {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<{
    print?: string;
    sig?: string;
    part?: string;
    days?: string;
    priced?: string;
    style?: string;
    title?: string;
  }>;
};

/**
 * Settings "Preview PDF" and golden renders: the sample Kashmir fixture printed
 * with a tenant's saved style. Worker only: needs the HMAC of
 * `preview:<tenantId>` (same scheme as the share print URL); 404 otherwise.
 */
export default async function PdfPreviewRoute({ params, searchParams }: Props) {
  const [{ tenantId }, sp] = await Promise.all([params, searchParams]);
  if (!z.string().uuid().safeParse(tenantId).success) notFound();
  if (sp.print !== "1" || !validPrintSignature(`preview:${tenantId}`, sp.sig, env.SESSION_SECRET))
    notFound();
  const days = Math.max(2, Math.min(15, Number(sp.days) || 5));
  const pdf = await loadPdfPreview(tenantId, {
    title: sp.title?.slice(0, 80),
    days,
    priced: sp.priced !== "0",
    styleId: sp.style,
  });
  if (!pdf) notFound();
  if (isPrintPart(sp.part))
    return <PdfPartPage part={sp.part} style={pdf.style} view={pdf.view} tokens={pdf.tokens} />;
  return <SharePage view={pdf.view.share} print pdfAccent={pdf.tokens.accentOnPaper} />;
}
