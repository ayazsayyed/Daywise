"use client";

import { ErrorState } from "@/components/ds/states";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorState error={error} reset={reset} backHref="/app" backLabel="Back to itineraries" />;
}
