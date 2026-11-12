"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";

import { getPdfJob, markShared, quickShare, requestPdf } from "./actions";

/**
 * Copy link / WhatsApp / PDF from the dashboard (PNG 06 hover row, PNG 18
 * sheet). Each counts as a first share (draft → Sent), like the panel.
 */
export function useQuickShare(id: string) {
  const router = useRouter();
  const [note, setNote] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = (msg: string) => {
    setNote(msg);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setNote(null), 2500);
  };
  const shared = useCallback(async () => {
    const r = await markShared(id);
    if (r.ok) router.refresh();
  }, [id, router]);

  const copyLink = async () => {
    const r = await quickShare(id);
    if (!r.ok) return flash(r.message);
    if (!r.data.enabled) return flash("Link sharing is off. Turn it on in Share.");
    try {
      await navigator.clipboard.writeText(r.data.url);
      flash("Link copied");
    } catch {
      flash(r.data.url);
    }
    await shared();
  };

  const whatsapp = async () => {
    // Open the tab synchronously (popup blockers), then point it at wa.me.
    const win = window.open("about:blank", "_blank");
    const r = await quickShare(id);
    if (!r.ok || !r.data.enabled) {
      win?.close();
      return flash(r.ok ? "Link sharing is off. Turn it on in Share." : r.message);
    }
    if (win) {
      win.opener = null;
      win.location.href = r.data.whatsapp;
    } else window.location.href = r.data.whatsapp;
    await shared();
  };

  const pdf = async () => {
    if (pdfBusy) return;
    setPdfBusy(true);
    flash("Preparing PDF…");
    const r = await requestPdf(id);
    if (!r.ok) {
      setPdfBusy(false);
      return flash(r.message);
    }
    void shared();
    const started = Date.now();
    const tick = async () => {
      const j = await getPdfJob(r.data.id);
      if (j.ok && j.data.status === "done") {
        setPdfBusy(false);
        flash("PDF ready");
        window.location.assign(`/api/pdf/${j.data.id}`);
        return;
      }
      if (!j.ok || j.data.status === "failed" || Date.now() - started > 60_000) {
        setPdfBusy(false);
        return flash(j.ok ? (j.data.error ?? "The PDF could not be prepared.") : j.message);
      }
      setNote(`Preparing PDF… ${Math.round((Date.now() - started) / 1000)} s`);
      setTimeout(() => void tick(), 1000);
    };
    setTimeout(() => void tick(), 1000);
  };

  return { note, pdfBusy, copyLink, whatsapp, pdf };
}
