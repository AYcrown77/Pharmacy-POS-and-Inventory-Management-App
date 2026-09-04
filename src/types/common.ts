/**
 * Primitive domain aliases shared across every module.
 */

/**
 * An amount in INTEGER kobo (₦1 = 100 kobo). Never a float.
 * See `lib/money.ts` for the reasoning and the formatters.
 */
export type Money = number;

/**
 * A calendar date as `YYYY-MM-DD` — used for expiry dates.
 *
 * Deliberately a string, not a `Date`. An expiry is a calendar day, not an
 * instant; putting it through a `Date` in Africa/Lagos can shift it by a day
 * and mislabel a batch as expired (or not). All arithmetic on these values
 * goes through `lib/date.ts`.
 */
export type DateOnly = string;

/** An instant in time, ISO 8601, always produced by the server. */
export type Timestamp = string;

/** A server-paginated collection. */
export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** Shared shape for list endpoints that support paging, search and sorting. */
export interface ListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortDir?: SortDirection;
}

export type SortDirection = "asc" | "desc";

/** An inclusive calendar-date range, used by every report filter. */
export interface DateRange {
  from: DateOnly;
  to: DateOnly;
}

/** A `<Select>` / filter option. */
export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
}
