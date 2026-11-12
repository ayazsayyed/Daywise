import type { Metadata } from "next";
import { count, eq, inArray, sql } from "drizzle-orm";
import { Search } from "lucide-react";

import { Page, PageTitle } from "@/components/ds";
import { Input } from "@/components/ui/input";
import { CreateTenantForm } from "@/features/admin/create-tenant-form";
import { loadTenantsOverview } from "@/features/admin/data";
import { TenantsTable, type TenantRow } from "@/features/admin/tenants-table";
import { tenantSubdomain } from "@/lib/config/brand";
import { db, schema } from "@/lib/db";
import { formatMonthYear, formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "Tenants · Admin" };
export const dynamic = "force-dynamic";

/** PNG 16: tenant table with usage + inline suspend, create-tenant card on the right. */
export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; deleted?: string }>;
}) {
  const { q = "", deleted } = await searchParams;
  const query = q.trim();
  const { rows, totals } = await loadTenantsOverview(query);

  const ids = rows.map((r) => r.tenant.id);
  const [userCounts, linkCounts] = ids.length
    ? await Promise.all([
        db
          .select({ tenantId: schema.users.tenantId, n: count() })
          .from(schema.users)
          .where(inArray(schema.users.tenantId, ids))
          .groupBy(schema.users.tenantId),
        db
          .select({ tenantId: schema.itineraries.tenantId, n: count() })
          .from(schema.shareLinks)
          .innerJoin(schema.itineraries, eq(schema.itineraries.id, schema.shareLinks.itineraryId))
          .where(sql`${schema.shareLinks.enabled} and ${inArray(schema.itineraries.tenantId, ids)}`)
          .groupBy(schema.itineraries.tenantId),
      ])
    : [[], []];
  const usersBy = new Map(userCounts.map((r) => [r.tenantId, r.n]));
  const linksBy = new Map(linkCounts.map((r) => [r.tenantId, r.n]));

  const tableRows: TenantRow[] = rows.map(({ tenant: t, usage, itineraries }) => ({
    id: t.id,
    name: t.name,
    domain: t.customDomain ?? tenantSubdomain(t.slug),
    status: t.status,
    itineraries,
    ai: usage.ai,
    aiCap: t.monthlyAiCap,
    places: usage.placesSearch + usage.placesPhoto,
    pdf: usage.pdf,
    users: usersBy.get(t.id) ?? 0,
    links: linksBy.get(t.id) ?? 0,
  }));

  return (
    <Page>
      <div className="grid gap-10 xl:grid-cols-[minmax(0,1010px)_366px] xl:gap-14">
        <div className="min-w-0">
          <PageTitle
            title="Tenants"
            subtitle={
              <>
                {formatMonthYear()} so far · <Num>{rows.length}</Num>{" "}
                {rows.length === 1 ? "tenant" : "tenants"} · <Num>{totals.ai}</Num> AI calls ·{" "}
                <Num>{totals.placesSearch + totals.placesPhoto}</Num> Places calls ·{" "}
                <Num>{totals.pdf}</Num> PDFs
              </>
            }
          >
            <form role="search" className="relative w-full sm:w-[280px]">
              <Search
                aria-hidden
                className="text-ink-muted pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              />
              <Input
                type="search"
                name="q"
                defaultValue={query}
                placeholder="Search tenants"
                aria-label="Search tenants"
                className="pl-9"
              />
            </form>
          </PageTitle>

          {deleted && (
            <p role="status" className="text-body-sm text-ink-secondary mt-6">
              Tenant deleted. Its itineraries, links and logins are gone; the deletion is in the
              audit log.
            </p>
          )}

          <div className="mt-8">
            <TenantsTable rows={tableRows} query={query} />
          </div>

          <p className="text-body-sm text-ink-muted mt-8">
            Usage is the current calendar month in IST. Places per tenant counts searches; photo
            proxy calls are not tied to a tenant and appear only in the total. Amber means over 80%
            of the tenant&apos;s monthly AI limit.
          </p>
        </div>
        <div className="xl:pt-2">
          <CreateTenantForm />
        </div>
      </div>
    </Page>
  );
}

function Num({ children }: { children: number }) {
  return <span className="text-ink tnum font-medium">{formatNumber(children)}</span>;
}
