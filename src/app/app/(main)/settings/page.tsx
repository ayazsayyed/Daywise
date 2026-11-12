import type { Metadata } from "next";

import Link from "next/link";

import { Page, PageTitle } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { requireTenant } from "@/lib/auth/guards";
import { SettingsForm } from "@/features/tenant/settings-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await requireTenant();
  const { tenant } = session;

  return (
    <Page>
      <PageTitle
        title="Agency settings"
        subtitle="How your agency appears on every itinerary you share, and the text new itineraries start with."
      />
      <SettingsForm
        key={tenant.updatedAt.toISOString()}
        tenantName={tenant.name}
        branding={tenant.branding}
        defaults={tenant.defaults}
      />
      <section
        aria-label="Your data"
        className="border-line mt-10 grid gap-6 border-t py-8 lg:grid-cols-[200px_minmax(0,560px)] lg:py-10"
      >
        <div className="flex flex-col gap-1 pr-6">
          <h2 className="text-heading-3 text-ink">Your data</h2>
          <p className="text-body-sm text-ink-secondary">
            Everything your agency has stored in Daywise.
          </p>
        </div>
        <div className="flex flex-col items-start gap-3">
          <p className="text-body-sm text-ink-secondary">
            A zip of JSON files: itineraries with days, stops and hotels, share links, usage and the
            activity log. See the{" "}
            <Link href="/privacy" className="text-ink underline underline-offset-4">
              privacy policy
            </Link>{" "}
            for what is kept and for how long.
          </p>
          <Button variant="secondary" asChild>
            <a href="/app/settings/export" download>
              Download your data
            </a>
          </Button>
        </div>
      </section>
    </Page>
  );
}
