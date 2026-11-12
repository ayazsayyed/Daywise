"use client";

import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

/**
 * Route error state (Day 5 UX polish): calm copy, Try again (re-renders the
 * segment), a way back, and the error reference for support. Reports to Sentry.
 */
export function ErrorState({
  error,
  reset,
  backHref,
  backLabel,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  backHref: string;
  backLabel: string;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return (
    <main className="px-4 pt-16 pb-24 sm:px-8 xl:px-24" role="alert">
      <div className="flex max-w-[560px] flex-col gap-4">
        <h1 className="text-display-2 text-ink">This page could not load.</h1>
        <p className="text-body text-ink-secondary">
          Nothing you saved is lost. Try again; if it keeps happening, send the reference below to
          support.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Button onClick={reset}>Try again</Button>
          <Button variant="secondary" asChild>
            <Link href={backHref}>{backLabel}</Link>
          </Button>
        </div>
        {error.digest && (
          <p className="text-caption text-ink-muted tnum">Reference {error.digest}</p>
        )}
      </div>
    </main>
  );
}
