import type { Metadata } from "next";

import { Page, PageTitle } from "@/components/ds";
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
    </Page>
  );
}
