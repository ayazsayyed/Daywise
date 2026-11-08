import type { Metadata } from "next";

import { PageHeader } from "@/components/app/page-header";
import { requireTenant } from "@/lib/auth/guards";
import { SettingsForm } from "@/features/tenant/settings-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await requireTenant();
  const { tenant } = session;

  return (
    <>
      <PageHeader
        title="Agency settings"
        description="Branding and default text that appear on every client-facing itinerary and PDF."
      />
      <SettingsForm
        tenantName={tenant.name}
        branding={tenant.branding}
        defaults={tenant.defaults}
        customDomain={tenant.customDomain}
      />
    </>
  );
}
