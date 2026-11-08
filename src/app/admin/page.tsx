import type { Metadata } from "next";
import { and, count, eq, gte, ilike, isNull, or, sql } from "drizzle-orm";
import { Search } from "lucide-react";

import { Page, PageTitle, StatusDot } from "@/components/ds";
import { Input } from "@/components/ui/input";
import { tenantSubdomain } from "@/lib/config/brand";
import { db, schema } from "@/lib/db";
import { formatMonthYear, formatNumber, startOfMonthIST } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Tenants · Admin" };

type Usage = { ai: number; places: number; pdf: number };

/** PNG 16 table shell. Create-tenant, suspend and reactivate arrive on Day 5. */
export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const query = q.trim();
  const since = startOfMonthIST();

  const tenants = await db
    .select()
    .from(schema.tenants)
    .where(
      query
        ? or(ilike(schema.tenants.name, `%${query}%`), ilike(schema.tenants.slug, `%${query}%`))
        : undefined,
    )
    .orderBy(schema.tenants.createdAt);

  const usageRows = await db
    .select({
      tenantId: schema.usageEvents.tenantId,
      kind: schema.usageEvents.kind,
      units: sql<number>`coalesce(sum(${schema.usageEvents.costUnits}), 0)::int`,
    })
    .from(schema.usageEvents)
    .where(gte(schema.usageEvents.createdAt, since))
    .groupBy(schema.usageEvents.tenantId, schema.usageEvents.kind);

  const itineraryRows = await db
    .select({ tenantId: schema.itineraries.tenantId, n: count() })
    .from(schema.itineraries)
    .where(and(isNull(schema.itineraries.deletedAt), eq(schema.itineraries.isTemplate, false)))
    .groupBy(schema.itineraries.tenantId);

  const usage = new Map<string, Usage>();
  const totals: Usage = { ai: 0, places: 0, pdf: 0 };
  for (const row of usageRows) {
    const key = row.tenantId ?? "";
    const u = usage.get(key) ?? { ai: 0, places: 0, pdf: 0 };
    if (row.kind === "ai") u.ai += row.units;
    else if (row.kind === "pdf") u.pdf += row.units;
    else u.places += row.units;
    usage.set(key, u);
    if (row.kind === "ai") totals.ai += row.units;
    else if (row.kind === "pdf") totals.pdf += row.units;
    else totals.places += row.units;
  }
  const itineraryCount = new Map(itineraryRows.map((r) => [r.tenantId, r.n]));

  return (
    <Page>
      <div className="max-w-[1010px]">
        <PageTitle
          title="Tenants"
          subtitle={
            <>
              {formatMonthYear()} so far · <Num>{tenants.length}</Num>{" "}
              {tenants.length === 1 ? "tenant" : "tenants"} · <Num>{totals.ai}</Num> AI calls ·{" "}
              <Num>{totals.places}</Num> Places calls · <Num>{totals.pdf}</Num> PDFs
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

        <div className="-mx-4 mt-8 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <table className="w-full min-w-[640px] border-collapse">
            <thead>
              <tr className="bg-surface-sunken h-10 text-left">
                <Th className="rounded-l-sm pl-5">Agency</Th>
                <Th align="right">Itineraries</Th>
                <Th align="right">AI calls</Th>
                <Th align="right">Places</Th>
                <Th align="right">PDFs</Th>
                <Th className="rounded-r-sm pr-5 pl-8">Status</Th>
              </tr>
            </thead>
            <tbody>
              {tenants.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-body-sm text-ink-muted py-10">
                    {query ? `No tenants match “${query}”.` : "No tenants yet. Run pnpm db:seed."}
                  </td>
                </tr>
              )}
              {tenants.map((t) => {
                const u = usage.get(t.id) ?? { ai: 0, places: 0, pdf: 0 };
                const aiShare = t.dailyGenCap > 0 ? u.ai / t.dailyGenCap : 0;
                const suspended = t.status === "suspended";
                return (
                  <tr key={t.id} className="border-line hover:bg-surface-sunken h-[60px] border-b">
                    <td className="py-2 pl-5">
                      <div className="flex flex-col">
                        <span
                          className={cn(
                            "text-heading-3 max-w-[260px] truncate",
                            suspended ? "text-ink-muted" : "text-ink",
                          )}
                        >
                          {t.name}
                        </span>
                        <span className="text-caption text-ink-muted">
                          {t.customDomain ?? tenantSubdomain(t.slug)}
                        </span>
                      </div>
                    </td>
                    <Td align="right">{formatNumber(itineraryCount.get(t.id) ?? 0)}</Td>
                    <Td align="right" className={cn(aiShare >= 0.8 && "text-amber")}>
                      {formatNumber(u.ai)}
                      {aiShare >= 0.8 && ` · ${Math.round(aiShare * 100)}%`}
                    </Td>
                    <Td align="right">{formatNumber(u.places)}</Td>
                    <Td align="right">{formatNumber(u.pdf)}</Td>
                    <td className="pr-5 pl-8">
                      <StatusDot kind="tenant" status={t.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="text-body-sm text-ink-muted mt-8">
          Usage is the current calendar month in IST. Amber means over 80% of the tenant&apos;s
          monthly AI limit.
        </p>
      </div>
    </Page>
  );
}

function Num({ children }: { children: number }) {
  return <span className="text-ink tnum font-medium">{formatNumber(children)}</span>;
}

function Th({
  children,
  align = "left",
  className,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={cn(
        "text-label text-ink-secondary px-4 font-medium",
        align === "right" && "text-right",
        className,
      )}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "left",
  className,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <td
      className={cn(
        "text-body-sm text-ink-secondary tnum px-4",
        align === "right" && "text-right",
        className,
      )}
    >
      {children}
    </td>
  );
}
