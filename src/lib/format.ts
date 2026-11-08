/**
 * Display formatting. Dates are stored UTC and shown `DD MMM YYYY` in Asia/Kolkata;
 * numbers use Indian grouping; currency is INR by default.
 */
export const TIMEZONE = "Asia/Kolkata";

const dayMonthYear = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: TIMEZONE,
});
const dayMonth = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  timeZone: TIMEZONE,
});
const dayOnly = new Intl.DateTimeFormat("en-IN", { day: "numeric", timeZone: TIMEZONE });
const monthYear = new Intl.DateTimeFormat("en-IN", {
  month: "long",
  year: "numeric",
  timeZone: TIMEZONE,
});
const time = new Intl.DateTimeFormat("en-IN", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: TIMEZONE,
});

type DateInput = Date | string | number;

function toDate(d: DateInput): Date {
  if (d instanceof Date) return d;
  // Plain `YYYY-MM-DD` (Postgres `date`) is a calendar day, not an instant.
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d))
    return new Date(`${d}T00:00:00+05:30`);
  return new Date(d);
}

/** 14 Mar 2027 */
export function formatDate(d: DateInput): string {
  return dayMonthYear.format(toDate(d)).replace(/,/g, "");
}

/** 14–18 Mar 2027 · 22 Dec 2026–2 Jan 2027 */
export function formatDateRange(start: DateInput, end: DateInput): string {
  const a = toDate(start);
  const b = toDate(end);
  const sameYear = a.getFullYear() === b.getFullYear();
  const sameMonth = sameYear && a.getMonth() === b.getMonth();
  if (sameMonth) return `${dayOnly.format(a)}–${formatDate(b)}`;
  if (sameYear) return `${dayMonth.format(a).replace(/,/g, "")}–${formatDate(b)}`;
  return `${formatDate(a)}–${formatDate(b)}`;
}

/** November 2026 */
export function formatMonthYear(d: DateInput = new Date()): string {
  return monthYear.format(toDate(d));
}

/** 12:41 */
export function formatTime(d: DateInput = new Date()): string {
  return time.format(toDate(d));
}

/** 4,212 · 1,84,500 (Indian grouping) */
export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n);
}

/** ₹84,500 */
export function formatINR(n: number): string {
  return `₹${formatNumber(n)}`;
}

/** Viewed 2 h ago · Viewed yesterday · Viewed 12 Nov */
export function relativeDay(d: DateInput, now: Date = new Date()): string {
  const then = toDate(d);
  const diffMs = now.getTime() - then.getTime();
  const min = Math.round(diffMs / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  const days = Math.round(h / 24);
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  return dayMonth.format(then).replace(/,/g, "");
}

/** Start of the current calendar month in IST, as a UTC instant. */
export function startOfMonthIST(now: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    timeZone: TIMEZONE,
  }).formatToParts(now);
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  return new Date(`${y}-${m}-01T00:00:00+05:30`);
}
