/**
 * Dashboard list maths (PNG 06): search across client, destination and cities;
 * status tabs with counts; sort; the summary line. Pure so it is unit-tested.
 */
export const LIST_TABS = ["all", "draft", "sent", "confirmed", "lost", "templates"] as const;
export type ListTab = (typeof LIST_TABS)[number];
export const LIST_SORTS = ["updated", "dates", "viewed"] as const;
export type ListSort = (typeof LIST_SORTS)[number];

export type ListRow = {
  id: string;
  title: string;
  status: "draft" | "sent" | "confirmed" | "lost";
  clientName: string | null;
  destination: string;
  cities: string[];
  startDate: string | null;
  updatedAt: Date;
  lastViewedAt: Date | null;
};

export function matchesQuery(row: ListRow, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return [row.clientName ?? "", row.title, row.destination, ...row.cities]
    .join(" ")
    .toLowerCase()
    .includes(needle);
}

export function countByStatus(rows: ListRow[]): Record<Exclude<ListTab, "templates">, number> {
  const c = { all: rows.length, draft: 0, sent: 0, confirmed: 0, lost: 0 };
  for (const r of rows) c[r.status]++;
  return c;
}

export function sortRows(rows: ListRow[], sort: ListSort): ListRow[] {
  const out = [...rows];
  const time = (d: Date | null) => (d ? d.getTime() : -Infinity);
  if (sort === "updated") out.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  if (sort === "viewed") out.sort((a, b) => time(b.lastViewedAt) - time(a.lastViewedAt));
  if (sort === "dates")
    // Soonest trip first; undated last.
    out.sort((a, b) => (a.startDate ?? "9999").localeCompare(b.startDate ?? "9999"));
  return out;
}

/** "57 itineraries · 21 waiting on a client reply · 3 viewed today" */
export function summaryLine(rows: ListRow[], now: Date = new Date()): string {
  const ist = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const today = ist(now);
  const waiting = rows.filter((r) => r.status === "sent").length;
  const viewedToday = rows.filter((r) => r.lastViewedAt && ist(r.lastViewedAt) === today).length;
  const parts = [`${rows.length} ${rows.length === 1 ? "itinerary" : "itineraries"}`];
  if (waiting) parts.push(`${waiting} waiting on a client reply`);
  if (viewedToday) parts.push(`${viewedToday} viewed today`);
  return parts.join(" · ");
}

export function parseTab(v: unknown): ListTab {
  return LIST_TABS.includes(v as ListTab) ? (v as ListTab) : "all";
}
export function parseSort(v: unknown): ListSort {
  return LIST_SORTS.includes(v as ListSort) ? (v as ListSort) : "updated";
}
