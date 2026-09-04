/**
 * Dates.
 *
 * Two distinct concepts, deliberately kept apart:
 *
 *   DateOnly  — a calendar day (`YYYY-MM-DD`), e.g. a batch expiry.
 *               Compared and shifted with pure integer arithmetic so no
 *               timezone can ever move it by a day.
 *   Timestamp — an instant (ISO 8601), e.g. when a sale happened.
 *               Rendered in the pharmacy's timezone.
 *
 * The pharmacy operates in Africa/Lagos (WAT, UTC+1, no DST).
 */

import type { DateOnly, DateRange, Timestamp } from "@/types/common";

const MS_PER_DAY = 86_400_000;

/* -------------------------------------------------------------------------
   DateOnly — calendar arithmetic
   ------------------------------------------------------------------------- */

/** Today as `YYYY-MM-DD`, in the viewer's local calendar. */
export function today(): DateOnly {
  return toDateOnly(new Date());
}

/** A `Date` (or the current instant) reduced to its local calendar day. */
export function toDateOnly(date: Date): DateOnly {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Epoch milliseconds for the UTC midnight of a calendar day.
 * Only ever compared against other values from this same function, so the
 * choice of UTC is an implementation detail that cancels out.
 */
function dateOnlyToEpoch(value: DateOnly): number {
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

/** Whole days from `from` to `to`. Negative when `to` is in the past. */
export function daysBetween(from: DateOnly, to: DateOnly): number {
  return Math.round((dateOnlyToEpoch(to) - dateOnlyToEpoch(from)) / MS_PER_DAY);
}

/** Whole days from today until `date`. Negative once it has passed. */
export function daysUntil(date: DateOnly): number {
  return daysBetween(today(), date);
}

/** Shift a calendar day by a number of days. */
export function addDays(date: DateOnly, days: number): DateOnly {
  const shifted = new Date(dateOnlyToEpoch(date) + days * MS_PER_DAY);
  const year = shifted.getUTCFullYear();
  const month = `${shifted.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${shifted.getUTCDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isPastDate(date: DateOnly): boolean {
  return daysUntil(date) < 0;
}

/** True when `date` falls within an inclusive range. */
export function isWithinRange(date: DateOnly, range: DateRange): boolean {
  return date >= range.from && date <= range.to; // ISO dates sort lexicographically
}

/* -------------------------------------------------------------------------
   Formatting
   ------------------------------------------------------------------------- */

const dayMonthYear = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const monthYear = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  year: "numeric",
});

const timeOfDay = new Intl.DateTimeFormat("en-GB", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

/** `2026-09-10` → "10 Sep 2026" */
export function formatDate(date: DateOnly): string {
  return dayMonthYear.format(new Date(dateOnlyToEpoch(date)));
}

/** `2026-09-10` → "Sep 2026" — for compact batch/expiry columns. */
export function formatMonthYear(date: DateOnly): string {
  return monthYear.format(new Date(dateOnlyToEpoch(date)));
}

/** ISO instant → "30 Aug 2026, 10:24 am" */
export function formatDateTime(timestamp: Timestamp): string {
  const date = new Date(timestamp);
  return `${dayMonthYear.format(date)}, ${timeOfDay.format(date)}`;
}

/** ISO instant → "10:24 am" */
export function formatTime(timestamp: Timestamp): string {
  return timeOfDay.format(new Date(timestamp));
}

/** ISO instant → its calendar day, for grouping and range filters. */
export function timestampToDateOnly(timestamp: Timestamp): DateOnly {
  return toDateOnly(new Date(timestamp));
}

/* -------------------------------------------------------------------------
   Relative language
   ------------------------------------------------------------------------- */

/**
 * Human expiry phrasing:
 *   "Expires in 22 days" · "Expires tomorrow" · "Expires today"
 *   "Expired 5 days ago" · "Expired yesterday"
 */
export function formatExpiryRelative(date: DateOnly): string {
  const days = daysUntil(date);
  if (days === 0) return "Expires today";
  if (days === 1) return "Expires tomorrow";
  if (days === -1) return "Expired yesterday";
  if (days > 0) {
    if (days < 61) return `Expires in ${days} days`;
    const months = Math.round(days / 30);
    if (days < 365) return `Expires in ~${months} months`;
    const years = Math.floor(days / 365);
    return `Expires in over ${years} year${years > 1 ? "s" : ""}`;
  }
  const elapsed = Math.abs(days);
  if (elapsed < 61) return `Expired ${elapsed} days ago`;
  const months = Math.round(elapsed / 30);
  return `Expired ~${months} months ago`;
}

/** "just now" · "12 minutes ago" · "3 hours ago" · then an absolute date. */
export function formatRelativeTime(timestamp: Timestamp): string {
  const elapsedMs = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(elapsedMs / 60_000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;

  return formatDate(timestampToDateOnly(timestamp));
}

/* -------------------------------------------------------------------------
   Report range presets
   ------------------------------------------------------------------------- */

export type DateRangePreset =
  | "today"
  | "yesterday"
  | "this-week"
  | "this-month"
  | "custom";

export const DATE_RANGE_PRESET_LABELS: Record<DateRangePreset, string> = {
  today: "Today",
  yesterday: "Yesterday",
  "this-week": "This Week",
  "this-month": "This Month",
  custom: "Custom",
};

/** Resolve a preset to concrete dates. `custom` returns today as a starting point. */
export function resolveDateRange(preset: DateRangePreset): DateRange {
  const now = today();

  switch (preset) {
    case "today":
      return { from: now, to: now };
    case "yesterday": {
      const yesterday = addDays(now, -1);
      return { from: yesterday, to: yesterday };
    }
    case "this-week": {
      // Week starts Monday.
      const weekday = new Date(dateOnlyToEpoch(now)).getUTCDay(); // 0 = Sunday
      const daysSinceMonday = (weekday + 6) % 7;
      return { from: addDays(now, -daysSinceMonday), to: now };
    }
    case "this-month":
      return { from: `${now.slice(0, 7)}-01`, to: now };
    case "custom":
      return { from: now, to: now };
  }
}
