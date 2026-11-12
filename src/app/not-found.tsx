import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col justify-center px-4 py-16 md:px-24">
      <div className="flex max-w-[560px] flex-col gap-4">
        <h1 className="text-display-2 text-ink">Page not found.</h1>
        <p className="text-body text-ink-secondary">
          The address may be mistyped, or the page belongs to another account.
        </p>
        <div className="pt-2">
          <Button variant="secondary" asChild>
            <Link href="/app">Go to itineraries</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
