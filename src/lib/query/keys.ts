/**
 * Query key factories.
 *
 * Every cache key in the application is produced here. Components never write
 * a raw key array, so invalidation after a mutation is a matter of naming the
 * right factory rather than guessing at a string that was typed elsewhere.
 */

import type { DateRange, ListParams } from "@/types/common";

export const authKeys = {
  all: ["auth"] as const,
  session: () => [...authKeys.all, "session"] as const,
};

export const productKeys = {
  all: ["products"] as const,
  lists: () => [...productKeys.all, "list"] as const,
  list: (filters: unknown) => [...productKeys.lists(), filters] as const,
  details: () => [...productKeys.all, "detail"] as const,
  detail: (id: string) => [...productKeys.details(), id] as const,
  barcode: (barcode: string) =>
    [...productKeys.all, "barcode", barcode] as const,
  search: (term: string) => [...productKeys.all, "search", term] as const,
  categories: () => [...productKeys.all, "categories"] as const,
};

export const inventoryKeys = {
  all: ["inventory"] as const,
  lists: () => [...inventoryKeys.all, "list"] as const,
  list: (filters: unknown) => [...inventoryKeys.lists(), filters] as const,
  summary: () => [...inventoryKeys.all, "summary"] as const,
  lowStock: (limit?: number) =>
    [...inventoryKeys.all, "low-stock", limit ?? "all"] as const,
};

export const batchKeys = {
  all: ["batches"] as const,
  lists: () => [...batchKeys.all, "list"] as const,
  list: (filters: unknown) => [...batchKeys.lists(), filters] as const,
  byProduct: (productId: string) =>
    [...batchKeys.all, "product", productId] as const,
  expiry: (filters: unknown) => [...batchKeys.all, "expiry", filters] as const,
  expiryAlerts: (limit: number) =>
    [...batchKeys.all, "expiry", "alerts", limit] as const,
  expirySummary: () => [...batchKeys.all, "expiry", "summary"] as const,
};

export const salesKeys = {
  all: ["sales"] as const,
  lists: () => [...salesKeys.all, "list"] as const,
  list: (filters: unknown) => [...salesKeys.lists(), filters] as const,
  details: () => [...salesKeys.all, "detail"] as const,
  detail: (id: string) => [...salesKeys.details(), id] as const,
  recent: (limit: number) => [...salesKeys.all, "recent", limit] as const,
  byReceipt: (receiptNumber: string) =>
    [...salesKeys.all, "receipt", receiptNumber] as const,
};

export const returnKeys = {
  all: ["returns"] as const,
  lists: () => [...returnKeys.all, "list"] as const,
  list: (filters: unknown) => [...returnKeys.lists(), filters] as const,
  bySale: (saleId: string) => [...returnKeys.all, "sale", saleId] as const,
};

export const movementKeys = {
  all: ["stock-movements"] as const,
  lists: () => [...movementKeys.all, "list"] as const,
  list: (filters: unknown) => [...movementKeys.lists(), filters] as const,
  recent: (limit: number) => [...movementKeys.all, "recent", limit] as const,
  byProduct: (productId: string) =>
    [...movementKeys.all, "product", productId] as const,
};

export const adjustmentKeys = {
  all: ["stock-adjustments"] as const,
  lists: () => [...adjustmentKeys.all, "list"] as const,
  list: (filters: unknown) => [...adjustmentKeys.lists(), filters] as const,
};

export const dashboardKeys = {
  all: ["dashboard"] as const,
  summary: () => [...dashboardKeys.all, "summary"] as const,
  salesTrend: (days: number) =>
    [...dashboardKeys.all, "sales-trend", days] as const,
  paymentMix: (days: number) =>
    [...dashboardKeys.all, "payment-mix", days] as const,
};

export const reportKeys = {
  all: ["reports"] as const,
  sales: (filters: unknown) => [...reportKeys.all, "sales", filters] as const,
  inventory: (filters: unknown) =>
    [...reportKeys.all, "inventory", filters] as const,
  expiry: (filters: unknown) => [...reportKeys.all, "expiry", filters] as const,
  movements: (filters: unknown) =>
    [...reportKeys.all, "movements", filters] as const,
  cashiers: (range: DateRange) =>
    [...reportKeys.all, "cashiers", range] as const,
};

export const userKeys = {
  all: ["users"] as const,
  lists: () => [...userKeys.all, "list"] as const,
  list: (filters: ListParams | undefined) =>
    [...userKeys.lists(), filters] as const,
  detail: (id: string) => [...userKeys.all, "detail", id] as const,
};

export const auditKeys = {
  all: ["audit"] as const,
  lists: () => [...auditKeys.all, "list"] as const,
  list: (filters: unknown) => [...auditKeys.lists(), filters] as const,
};

export const settingsKeys = {
  all: ["settings"] as const,
  pharmacy: () => [...settingsKeys.all, "pharmacy"] as const,
  terminals: () => [...settingsKeys.all, "terminals"] as const,
};

export const healthKeys = {
  all: ["health"] as const,
  server: () => [...healthKeys.all, "server"] as const,
};

/**
 * Everything that a completed sale, a stock receipt or an adjustment makes
 * stale. Mutations invalidate this set rather than listing keys by hand and
 * inevitably forgetting one.
 */
export const STOCK_AFFECTING_KEYS = [
  inventoryKeys.all,
  batchKeys.all,
  movementKeys.all,
  productKeys.all,
  dashboardKeys.all,
  reportKeys.all,
] as const;
