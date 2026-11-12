"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  applyOp,
  coalesceKey,
  isStructural,
  mergeOps,
  type EditorDay,
  type EditorDoc,
  type EditorOp,
} from "@/lib/itinerary/doc";

import { saveOps } from "./actions";

export type SaveStatus = {
  state: "idle" | "saving" | "saved" | "unsaved" | "failed";
  at?: string;
  message?: string;
};

const TEXT_DEBOUNCE_MS = 700;

/**
 * Editor state + autosave. Every edit is an op: applied to the local doc at
 * once (optimistic), queued, coalesced with the previous op on the same
 * field, and flushed to `saveOps` after a short pause (immediately for
 * structural edits). One request in flight at a time; a failed batch is kept
 * and retried; an invalid batch is dropped and the page re-syncs.
 */
export function useEditor(initial: EditorDoc) {
  const router = useRouter();
  const [doc, setDoc] = useState(initial);
  const [status, setStatus] = useState<SaveStatus>({ state: "idle" });
  const queue = useRef<EditorOp[]>([]);
  const inflight = useRef<Promise<void> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idRef = useRef(initial.id);
  const failed = useRef(false);

  const flush = useCallback(async (): Promise<void> => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (inflight.current) {
      await inflight.current;
      if (queue.current.length) return flush();
      return;
    }
    if (!queue.current.length) return;
    const batch = queue.current.splice(0);
    setStatus({ state: "saving" });
    const run = (async () => {
      const res = await saveOps(idRef.current, batch).catch(() => null);
      failed.current = !res?.ok;
      if (res?.ok) {
        setStatus(
          queue.current.length ? { state: "unsaved" } : { state: "saved", at: clock(res.at) },
        );
        return;
      }
      if (res && (res.code === "invalid" || res.code === "gone")) {
        // The server refused the batch: drop it and reload the truth.
        setStatus({ state: "failed", message: res.message });
        router.refresh();
        return;
      }
      queue.current.unshift(...batch);
      setStatus({ state: "failed", message: res?.message ?? "Not saved" });
    })();
    inflight.current = run;
    await run;
    inflight.current = null;
    // A failed batch waits for Retry or the next edit instead of looping.
    if (queue.current.length && !failed.current) schedule(TEXT_DEBOUNCE_MS);
    // `schedule` is defined below and stable; listing it would create a cycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const schedule = useCallback(
    (ms: number) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), ms);
    },
    [flush],
  );

  const dispatch = useCallback(
    (op: EditorOp) => {
      setDoc((d) => applyOp(d, op));
      const q = queue.current;
      const key = coalesceKey(op);
      const last = q[q.length - 1];
      if (key && last && coalesceKey(last) === key) q[q.length - 1] = mergeOps(last, op);
      else q.push(op);
      setStatus({ state: "unsaved" });
      schedule(isStructural(op) ? 0 : TEXT_DEBOUNCE_MS);
    },
    [schedule],
  );

  /** Replace a day with server data (regenerate) without queueing an op. */
  const replaceDay = useCallback((day: EditorDay) => {
    setDoc((d) => ({ ...d, days: d.days.map((x) => (x.id === day.id ? day : x)) }));
  }, []);

  /** Local-only preview during drag (no save). */
  const preview = useCallback((fn: (d: EditorDoc) => EditorDoc) => setDoc(fn), []);

  // Re-sync when the server component re-renders with fresher data (router.refresh()).
  useEffect(() => {
    if (!queue.current.length && !inflight.current) setDoc(initial);
    idRef.current = initial.id;
  }, [initial]);

  // Warn before leaving with unsaved edits; flush when the tab is hidden.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (queue.current.length || inflight.current) {
        void flush();
        e.preventDefault();
      }
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [flush]);

  return { doc, status, dispatch, flush, replaceDay, preview, retry: () => void flush() };
}

function clock(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Kolkata",
  }).format(new Date(iso));
}
