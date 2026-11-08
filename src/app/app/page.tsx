import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Sparkles } from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { requireTenant } from "@/lib/auth/guards";
import { tenantScope } from "@/lib/db/tenant";

export const metadata: Metadata = { title: "Itineraries" };

export default async function DashboardPage() {
  const session = await requireTenant();
  const itineraries = await tenantScope(session.tenant.id).listItineraries();

  return (
    <>
      <PageHeader
        title="Itineraries"
        description={`${session.tenant.name} · drafts, sent and confirmed trips.`}
        actions={
          <Button disabled title="Itinerary generation arrives on Day 3">
            <Plus /> New itinerary
          </Button>
        }
      />

      {itineraries.length === 0 ? (
        <section
          aria-label="No itineraries yet"
          className="bg-card/60 grid place-items-center rounded-xl border border-dashed px-6 py-20 text-center"
        >
          <div className="bg-accent text-primary grid size-12 place-items-center rounded-full">
            <Sparkles className="size-5" aria-hidden />
          </div>
          <h2 className="mt-5 text-lg font-semibold">No itineraries yet</h2>
          <p className="text-muted-foreground mt-2 max-w-sm text-sm">
            Soon you&apos;ll type something like{" "}
            <span className="text-foreground font-medium">
              “5-day Kashmir for a couple, mid-range”
            </span>{" "}
            and Daywise will draft a verified, photo-rich, day-wise plan for you to edit and share.
          </p>
          <p className="text-muted-foreground mt-6 text-xs">
            Until then, set your agency branding in{" "}
            <Link
              href="/app/settings"
              className="text-primary font-medium underline-offset-4 hover:underline"
            >
              Settings
            </Link>
            .
          </p>
        </section>
      ) : (
        <ul className="bg-card divide-y rounded-xl border">
          {itineraries.map((it) => (
            <li key={it.id} className="flex items-center justify-between px-5 py-4">
              <span className="font-medium">{it.title}</span>
              <span className="text-muted-foreground text-xs uppercase">{it.status}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
