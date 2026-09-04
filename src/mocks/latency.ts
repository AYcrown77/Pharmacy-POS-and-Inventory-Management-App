/**
 * Mock transport behaviour.
 *
 * Adapters go through these helpers so the UI is exercised against realistic
 * timing — skeletons actually appear, buttons actually spend time in their
 * loading state — rather than resolving instantly and hiding those states.
 */

import { ApiError } from "@/lib/api/http";
import { MockApiError } from "./db";
import type { ListParams, Paginated } from "@/types/common";

const MIN_DELAY_MS = 120;
const MAX_DELAY_MS = 380;

function randomDelay(): number {
  return MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS);
}

export function delay(ms = randomDelay()): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run a mock operation with realistic latency, translating the store's errors
 * into the same `ApiError` the HTTP client raises. Pages therefore handle one
 * error type regardless of where the data came from.
 */
export async function mockRequest<T>(operation: () => T): Promise<T> {
  await delay();
  try {
    return operation();
  } catch (error) {
    if (error instanceof MockApiError) {
      throw new ApiError(
        error.status,
        error.message,
        error.code,
        undefined,
        error.details,
      );
    }
    throw error;
  }
}

/** Apply page/pageSize to an already-filtered, already-sorted list. */
export function paginate<T>(items: T[], params: ListParams = {}): Paginated<T> {
  const page = Math.max(params.page ?? 1, 1);
  const pageSize = Math.max(params.pageSize ?? 25, 1);
  const start = (page - 1) * pageSize;

  return {
    data: items.slice(start, start + pageSize),
    page,
    pageSize,
    total: items.length,
    totalPages: Math.max(Math.ceil(items.length / pageSize), 1),
  };
}

/** Case-insensitive "does any of these fields contain the search term". */
export function matchesSearch(
  search: string | undefined,
  ...fields: Array<string | null | undefined>
): boolean {
  if (!search) return true;
  const term = search.trim().toLowerCase();
  if (!term) return true;
  return fields.some((field) => field?.toLowerCase().includes(term));
}

/** Sort a list by a resolved key, tolerating strings and numbers. */
export function sortBy<T>(
  items: T[],
  resolve: (item: T) => string | number | null,
  direction: "asc" | "desc" = "asc",
): T[] {
  const factor = direction === "asc" ? 1 : -1;
  return [...items].sort((a, b) => {
    const left = resolve(a);
    const right = resolve(b);
    if (left === right) return 0;
    if (left === null) return 1;
    if (right === null) return -1;
    if (typeof left === "number" && typeof right === "number") {
      return (left - right) * factor;
    }
    return String(left).localeCompare(String(right)) * factor;
  });
}
