import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";

import {
  Page,
  PageTitle,
  PhotoFrame,
  SectionLabel,
  StatusDot,
  TopBarAction,
} from "@/components/ds";
import { Button } from "@/components/ui/button";
import { requireTenant } from "@/lib/auth/guards";
import { tenantScope } from "@/lib/db/tenant";
import { formatDateRange } from "@/lib/format";

export const metadata: Metadata = { title: "Itineraries" };

export default async function DashboardPage() {
  const session = await requireTenant();
  const itineraries = await tenantScope(session.tenant.id).listItineraries();

  if (itineraries.length === 0) return <EmptyState />;

  return (
    <Page>
      <TopBarAction>
        <Button disabled title="Itinerary generation arrives on Day 3">
          <Plus aria-hidden /> New itinerary
        </Button>
      </TopBarAction>
      <PageTitle
        title="Itineraries"
        subtitle={`${itineraries.length} ${itineraries.length === 1 ? "itinerary" : "itineraries"}`}
      />
      <table className="mt-8 w-full border-collapse">
        <thead>
          <tr className="bg-surface-sunken h-10 text-left">
            <th className="text-label text-ink-secondary rounded-l-sm pl-5 font-medium">Client</th>
            <th className="text-label text-ink-secondary font-medium">Destination</th>
            <th className="text-label text-ink-secondary font-medium">Dates</th>
            <th className="text-label text-ink-secondary rounded-r-sm pr-5 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {itineraries.map((it, i) => (
            <tr key={it.id} className="border-line hover:bg-surface-sunken h-[52px] border-b">
              <td className="pl-5">
                <div className="flex items-center gap-4">
                  <PhotoFrame ratio="1:1" index={i} alt="" className="size-10 rounded-md" />
                  <div className="flex flex-col">
                    <span className="text-heading-3 text-ink">{it.client?.name ?? it.title}</span>
                    {it.client && (
                      <span className="text-caption text-ink-muted">
                        {paxLabel(it.client.pax.adults, it.client.pax.children)}
                      </span>
                    )}
                  </div>
                </div>
              </td>
              <td className="text-body-sm text-ink-secondary">{it.title}</td>
              <td className="text-body-sm text-ink-secondary tnum">
                {it.startDate && it.endDate ? formatDateRange(it.startDate, it.endDate) : "—"}
              </td>
              <td className="pr-5">
                <StatusDot status={it.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Page>
  );
}

function paxLabel(adults: number, children: number): string {
  const a = `${adults} ${adults === 1 ? "adult" : "adults"}`;
  if (!children) return a;
  return `${a}, ${children} ${children === 1 ? "child" : "children"}`;
}

/** PNG 07: display-1 copy and three numbered steps. No box, no illustration. */
function EmptyState() {
  return (
    <Page className="pt-16 lg:pt-[136px]">
      <div className="flex max-w-[1104px] flex-col">
        <section aria-labelledby="empty-title" className="flex max-w-[640px] flex-col gap-6">
          <SectionLabel>Itineraries</SectionLabel>
          <h1 id="empty-title" className="text-display-1 text-ink">
            Your first itinerary is one sentence away.
          </h1>
          <p className="text-body text-ink-secondary">
            Describe the trip the way a client would ask for it. You review the brief, Daywise
            drafts the days, hotels and photos, and you share a link or PDF.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-5">
            <Button size="lg" className="h-12 px-6" disabled title="Arrives on Day 3">
              Create an itinerary <ArrowRight aria-hidden />
            </Button>
            <Link
              href="/app/settings"
              className="focus-ring text-body text-ink rounded-sm font-medium"
            >
              Add your logo and contact details first
            </Link>
          </div>
        </section>

        <ol className="border-line mt-24 grid gap-10 border-t pt-8 sm:grid-cols-3 sm:gap-6">
          {[
            ["Describe", "“5-day Kashmir for a couple, mid-range, mid-March.”"],
            ["Review and edit", "Reorder days and stops, swap hotels, set your price."],
            ["Share", "Send a link on WhatsApp or a PDF, and see when it is opened."],
          ].map(([title, body], i) => (
            <li key={title} className="flex flex-col gap-2 pr-6">
              <span className="text-body-sm text-ink-muted tnum">0{i + 1}</span>
              <h2 className="text-heading-3 text-ink">{title}</h2>
              <p className="text-body-sm text-ink-secondary">{body}</p>
            </li>
          ))}
        </ol>
      </div>
    </Page>
  );
}
