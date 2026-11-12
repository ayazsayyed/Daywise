import type { Metadata } from "next";

import { NewItineraryFlow } from "@/features/itinerary/new-flow";
import { requireTenant } from "@/lib/auth/guards";
import { tenantScope } from "@/lib/db/tenant";

export const metadata: Metadata = { title: "New itinerary" };

export default async function NewItineraryPage() {
  const session = await requireTenant();
  const templates = await tenantScope(session.tenant.id).listForDashboard({ templates: true });
  return (
    <NewItineraryFlow
      templates={templates.slice(0, 8).map((t) => ({
        id: t.id,
        title: t.title,
        meta: [t.cities.join(", "), `${t.days.length} days`].filter(Boolean).join(" · "),
      }))}
    />
  );
}
