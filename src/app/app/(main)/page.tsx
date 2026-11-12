import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";

import { Page, PhotoFrame, SectionLabel, StatusDot, TopBarAction } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { toEditorImage } from "@/features/editor/load";
import { ListSearch, ListSort } from "@/features/itinerary/list-controls";
import { HoverActions, SheetActions } from "@/features/itinerary/row-actions";
import { parseStoredBrief } from "@/lib/ai/schemas";
import { requireTenant } from "@/lib/auth/guards";
import { tenantScope } from "@/lib/db/tenant";
import { formatDateRange, relativeDay } from "@/lib/format";
import {
  countByStatus,
  matchesQuery,
  parseSort,
  parseTab,
  sortRows,
  summaryLine,
  type ListRow,
} from "@/lib/itinerary/list";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Itineraries" };

const PAGE = 14;
const TAB_LABEL = {
  all: "All",
  draft: "Draft",
  sent: "Sent",
  confirmed: "Confirmed",
  lost: "Lost",
  templates: "Templates",
} as const;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const session = await requireTenant();
  const scope = tenantScope(session.tenant.id);
  const [live, templates] = await Promise.all([
    scope.listForDashboard(),
    scope.listForDashboard({ templates: true }),
  ]);

  if (live.length === 0 && templates.length === 0) return <EmptyState />;

  const tab = parseTab(sp.status);
  const sort = parseSort(sp.sort);
  const q = typeof sp.q === "string" ? sp.q.slice(0, 80) : "";
  const show = Math.min(500, Math.max(PAGE, Number(sp.show) || PAGE));

  const enrich = (r: (typeof live)[number]) => {
    const brief = parseStoredBrief(r.brief);
    const raw = (r.brief ?? {}) as { destination?: string };
    return {
      id: r.id,
      title: r.title,
      status: r.status,
      clientName: r.client?.name || null,
      pax: r.client?.pax ?? brief?.pax ?? null,
      destination: brief?.destination ?? raw.destination ?? "",
      cities: r.cities,
      startDate: r.startDate,
      endDate: r.endDate,
      nights: Math.max(0, r.days.length - 1),
      updatedAt: r.updatedAt,
      lastViewedAt: r.lastViewedAt,
      thumb: toEditorImage(r.hero, 200),
      template: r.isTemplate,
    };
  };
  const all = live.map(enrich);
  const tpl = templates.map(enrich);
  const counts = countByStatus(all as ListRow[]);
  const pool =
    tab === "templates" ? tpl : tab === "all" ? all : all.filter((r) => r.status === tab);
  const matching = sortRows(
    pool.filter((r) => matchesQuery(r as ListRow, q)) as ListRow[],
    sort,
  ) as typeof all;
  const visible = matching.slice(0, show);
  const deleted = sp.deleted === "1";

  const tabHref = (t: string) => {
    const next = new URLSearchParams();
    if (t !== "all") next.set("status", t);
    if (q) next.set("q", q);
    if (sort !== "updated") next.set("sort", sort);
    const qs = next.toString();
    return qs ? `/app?${qs}` : "/app";
  };
  const moreHref = (() => {
    const next = new URLSearchParams();
    if (tab !== "all") next.set("status", tab);
    if (q) next.set("q", q);
    if (sort !== "updated") next.set("sort", sort);
    next.set("show", String(show + 50));
    return `/app?${next.toString()}`;
  })();

  return (
    <Page className="pt-6 lg:pt-14">
      <TopBarAction>
        <Button asChild className="h-10">
          <Link href="/app/new">
            <Plus aria-hidden /> <span className="hidden sm:inline">New itinerary</span>
            <span className="sm:hidden">New</span>
          </Link>
        </Button>
      </TopBarAction>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
        <div className="flex items-baseline justify-between gap-4 sm:flex-col sm:items-start sm:gap-2">
          <h1 className="text-display-2 text-ink">Itineraries</h1>
          <p className="text-body text-ink-secondary hidden sm:block">
            {summaryLine(all as ListRow[])}
          </p>
          <span className="text-body-sm text-ink-muted tnum sm:hidden">{all.length}</span>
        </div>
        <ListSearch className="w-full sm:max-w-[412px]" />
      </div>

      {deleted && (
        <p className="text-body-sm text-ink-secondary mt-4" role="status">
          Deleted. It no longer appears in your list.
        </p>
      )}

      <div className="border-line mt-6 flex items-end justify-between gap-6 border-b lg:mt-10">
        <nav aria-label="Filter by status" className="-mb-px flex gap-6 overflow-x-auto">
          {(["all", "draft", "sent", "confirmed", "lost", "templates"] as const)
            .filter((t) => t !== "templates" || tpl.length > 0)
            .map((t) => {
              const n = t === "templates" ? tpl.length : counts[t];
              const active = t === tab;
              return (
                <Link
                  key={t}
                  href={tabHref(t)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "focus-ring text-body flex h-11 shrink-0 items-center gap-1.5 border-b-2 whitespace-nowrap",
                    active
                      ? "border-indigo text-ink font-medium"
                      : "text-ink-secondary hover:text-ink border-transparent",
                  )}
                >
                  {TAB_LABEL[t]} <span className="text-ink-muted tnum font-normal">{n}</span>
                </Link>
              );
            })}
        </nav>
        <div className="hidden pb-2.5 sm:block">
          <ListSort value={sort} />
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="text-body text-ink-secondary py-10">
          {q ? `Nothing matches “${q}”.` : "Nothing here yet."}
        </p>
      ) : (
        <>
          {/* Desktop table (PNG 06) */}
          <table className="hidden w-full border-collapse md:table">
            <thead>
              <tr className="bg-surface-sunken h-10 text-left">
                <th className="text-label text-ink-secondary w-[38%] pl-5 font-medium">Client</th>
                <th className="text-label text-ink-secondary font-medium">Destination</th>
                <th className="text-label text-ink-secondary font-medium">Dates</th>
                <th className="text-label text-ink-secondary hidden font-medium xl:table-cell">
                  Last viewed by client
                </th>
                <th className="text-label text-ink-secondary pr-5 font-medium">
                  {tab === "templates" ? "" : "Status"}
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((it, i) => {
                const lost = it.status === "lost";
                return (
                  <tr
                    key={it.id}
                    className="group border-line hover:bg-surface-sunken relative h-[60px] border-b"
                  >
                    <td className="pl-3">
                      <div className="flex items-center gap-4">
                        <PhotoFrame
                          ratio="1:1"
                          index={i}
                          src={it.thumb?.source === "placeholder" ? null : it.thumb?.url}
                          alt=""
                          placeholderLabel=""
                          className="size-10 shrink-0 rounded-md"
                        />
                        <div className="flex min-w-0 flex-col">
                          <Link
                            href={`/app/i/${it.id}`}
                            className={cn(
                              "focus-ring text-heading-3 truncate rounded-sm after:absolute after:inset-0",
                              lost ? "text-ink-muted" : "text-ink",
                            )}
                          >
                            {it.template ? it.title : (it.clientName ?? it.title)}
                          </Link>
                          <span className="text-caption text-ink-muted truncate">
                            {it.template
                              ? "Template"
                              : it.pax
                                ? paxLabel(it.pax.adults, it.pax.children)
                                : it.title}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="text-body-sm text-ink-secondary">
                      <span className="text-ink font-medium">{it.destination}</span>
                      {it.cities.length > 0 && ` · ${it.cities.join(", ")}`}
                    </td>
                    <td className="text-body-sm text-ink-secondary tnum whitespace-nowrap">
                      {it.startDate && it.endDate
                        ? `${formatDateRange(it.startDate, it.endDate)} · ${it.nights}N`
                        : `${it.nights}N`}
                    </td>
                    <td className="text-body-sm text-ink-secondary hidden xl:table-cell">
                      {it.template
                        ? ""
                        : it.lastViewedAt
                          ? `Viewed ${relativeDay(it.lastViewedAt)}`
                          : "Never viewed"}
                    </td>
                    <td className="pr-5">
                      {!it.template && <StatusDot status={it.status} />}
                      <div className="bg-surface-sunken absolute inset-y-0 right-0 z-10 hidden items-center pr-3 pl-6 group-focus-within:flex group-hover:flex">
                        <HoverActions id={it.id} template={it.template} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Phone cards (PNG 18) */}
          <ul className="md:hidden">
            {visible.map((it, i) => {
              const meta = [
                it.destination,
                it.startDate && it.endDate ? formatDateRange(it.startDate, it.endDate) : null,
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <li key={it.id} className="border-line relative flex gap-4 border-b py-4">
                  <PhotoFrame
                    ratio="1:1"
                    index={i}
                    src={it.thumb?.source === "placeholder" ? null : it.thumb?.url}
                    alt=""
                    placeholderLabel=""
                    className="size-12 shrink-0 rounded-md"
                  />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <Link
                        href={`/app/i/${it.id}`}
                        className={cn(
                          "focus-ring text-heading-3 truncate rounded-sm after:absolute after:inset-0",
                          it.status === "lost" ? "text-ink-muted" : "text-ink",
                        )}
                      >
                        {it.template ? it.title : (it.clientName ?? it.title)}
                      </Link>
                      {!it.template && <StatusDot status={it.status} className="shrink-0" />}
                    </div>
                    <span className="text-body-sm text-ink-secondary truncate">{meta}</span>
                    <span className="text-body-sm text-ink-muted">
                      {it.template
                        ? "Template"
                        : it.lastViewedAt
                          ? `Viewed ${relativeDay(it.lastViewedAt)}`
                          : "Never viewed"}
                    </span>
                  </div>
                  <SheetActions
                    id={it.id}
                    title={it.template ? it.title : (it.clientName ?? it.title)}
                    template={it.template}
                    meta={[meta, it.template ? "Template" : statusWord(it.status)].join(" · ")}
                  />
                </li>
              );
            })}
          </ul>

          <div className="mt-6 flex items-center justify-between gap-4">
            <span className="text-body-sm text-ink-secondary tnum">
              Showing {visible.length} of {matching.length}
            </span>
            {matching.length > visible.length && (
              <Button variant="secondary" asChild>
                <Link href={moreHref} scroll={false}>
                  Show {Math.min(50, matching.length - visible.length)} more
                </Link>
              </Button>
            )}
          </div>
        </>
      )}
    </Page>
  );
}

function statusWord(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
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
            <Button size="lg" className="h-12 px-6" asChild>
              <Link href="/app/new">
                Create an itinerary <ArrowRight aria-hidden />
              </Link>
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
