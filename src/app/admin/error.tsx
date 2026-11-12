"use client";

import { ErrorState } from "@/components/ds/states";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorState error={error} reset={reset} backHref="/admin" backLabel="Back to tenants" />;
}
