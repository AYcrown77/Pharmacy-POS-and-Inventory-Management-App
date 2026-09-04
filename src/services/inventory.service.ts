/**
 * Inventory, batches and the stock movement ledger.
 *
 * Everything here is derived from batches — a product never carries a
 * quantity of its own.
 */

import { USE_MOCKS } from "@/lib/api/config";
import { http } from "@/lib/api/http";
import { daysUntil, timestampToDateOnly } from "@/lib/date";
import {
  batchesForProduct,
  buildInventoryItem,
  db,
  refreshBatchExpiry,
} from "@/mocks/db";
import { matchesSearch, mockRequest, paginate, sortBy } from "@/mocks/latency";
import { deriveExpiryStatus, EXPIRY_STATUS_ORDER } from "@/lib/status";
import type { ListParams, Paginated } from "@/types/common";
import type {
  ExpiryAlertItem,
  ExpirySummary,
  InventorySummary,
  LowStockItem,
  RecentMovementSummary,
} from "@/types/analytics";
import type {
  Batch,
  ExpiryStatus,
  InventoryItem,
  MovementType,
  StockMovement,
  StockStatus,
} from "@/types/domain";

export interface InventoryFilters extends ListParams {
  categoryId?: string;
  stockStatus?: StockStatus;
  expiryStatus?: ExpiryStatus;
}

export interface BatchFilters extends ListParams {
  productId?: string;
  categoryId?: string;
  expiryStatus?: ExpiryStatus;
  supplierName?: string;
  /** Hide batches that have been fully drawn down. */
  onlyInStock?: boolean;
}

export interface MovementFilters extends ListParams {
  productId?: string;
  batchId?: string;
  movementType?: MovementType;
  userId?: string;
  from?: string;
  to?: string;
}

export interface InventoryService {
  list(filters?: InventoryFilters): Promise<Paginated<InventoryItem>>;
  getSummary(): Promise<InventorySummary>;
  getLowStock(limit?: number): Promise<LowStockItem[]>;

  listBatches(filters?: BatchFilters): Promise<Paginated<Batch>>;
  getBatchesForProduct(productId: string): Promise<Batch[]>;

  getExpiryAlerts(limit?: number): Promise<ExpiryAlertItem[]>;
  listExpiring(filters?: BatchFilters): Promise<Paginated<ExpiryAlertItem>>;
  getExpirySummary(): Promise<ExpirySummary>;

  listMovements(filters?: MovementFilters): Promise<Paginated<StockMovement>>;
  getRecentMovements(limit?: number): Promise<RecentMovementSummary[]>;
}

/* -------------------------------------------------------------------------
   Mock adapter
   ------------------------------------------------------------------------- */

function allInventoryItems(): InventoryItem[] {
  return db.products
    .filter((product) => product.isActive)
    .map(buildInventoryItem);
}

function toExpiryAlert(batch: Batch): ExpiryAlertItem {
  refreshBatchExpiry(batch);
  return {
    batchId: batch.id,
    productId: batch.productId,
    productName: batch.product?.name ?? "Unknown product",
    batchNumber: batch.batchNumber,
    quantityRemaining: batch.quantityRemaining,
    expiryDate: batch.expiryDate,
    daysUntilExpiry: batch.daysUntilExpiry,
    expiryStatus: batch.expiryStatus,
    stockValue: batch.quantityRemaining * batch.costPrice,
  };
}

function applyBatchFilters(filters: BatchFilters): Batch[] {
  return db.batches
    .map(refreshBatchExpiry)
    .filter(
      (batch) =>
        (!filters.productId || batch.productId === filters.productId) &&
        (!filters.categoryId ||
          batch.product?.categoryId === filters.categoryId) &&
        (!filters.expiryStatus ||
          batch.expiryStatus === filters.expiryStatus) &&
        (!filters.supplierName ||
          batch.supplierName === filters.supplierName) &&
        (!filters.onlyInStock || batch.quantityRemaining > 0) &&
        matchesSearch(
          filters.search,
          batch.product?.name,
          batch.batchNumber,
          batch.supplierName,
        ),
    );
}

const mockInventoryService: InventoryService = {
  list: (filters = {}) =>
    mockRequest(() => {
      let items = allInventoryItems();

      items = items.filter(
        (item) =>
          matchesSearch(
            filters.search,
            item.product.name,
            item.product.genericName,
            item.product.brandName,
            item.product.barcode,
          ) &&
          (!filters.categoryId ||
            item.product.categoryId === filters.categoryId) &&
          (!filters.stockStatus || item.stockStatus === filters.stockStatus) &&
          (!filters.expiryStatus ||
            item.expiryStatus === filters.expiryStatus),
      );

      const direction = filters.sortDir ?? "asc";
      const sorted =
        filters.sortBy === "availableStock"
          ? sortBy(items, (item) => item.availableStock, direction)
          : filters.sortBy === "stockValue"
            ? sortBy(items, (item) => item.stockValue, direction)
            : filters.sortBy === "nearestExpiry"
              ? sortBy(items, (item) => item.nearestExpiry, direction)
              : sortBy(items, (item) => item.product.name, direction);

      return paginate(sorted, filters);
    }),

  getSummary: () =>
    mockRequest(() => {
      const items = allInventoryItems();
      const batches = db.batches.map(refreshBatchExpiry);

      return {
        totalProducts: items.length,
        totalStockUnits: items.reduce(
          (total, item) => total + item.availableStock,
          0,
        ),
        inventoryValue: items.reduce(
          (total, item) => total + item.stockValue,
          0,
        ),
        lowStockCount: items.filter((item) => item.stockStatus === "LOW_STOCK")
          .length,
        outOfStockCount: items.filter(
          (item) => item.stockStatus === "OUT_OF_STOCK",
        ).length,
        // Counted per batch: one product can have several batches running out.
        expiringSoonCount: batches.filter(
          (batch) =>
            batch.quantityRemaining > 0 &&
            batch.daysUntilExpiry >= 0 &&
            batch.daysUntilExpiry <= 90,
        ).length,
        expiredCount: batches.filter(
          (batch) => batch.quantityRemaining > 0 && batch.daysUntilExpiry < 0,
        ).length,
      } satisfies InventorySummary;
    }),

  getLowStock: (limit) =>
    mockRequest(() => {
      const items = allInventoryItems()
        .filter(
          (item) =>
            item.stockStatus === "LOW_STOCK" ||
            item.stockStatus === "OUT_OF_STOCK",
        )
        .map<LowStockItem>((item) => ({
          productId: item.productId,
          productName: item.product.name,
          categoryName: item.product.category?.name ?? null,
          availableStock: item.availableStock,
          minimumStockLevel: item.minimumStockLevel,
          shortfall: Math.max(
            item.minimumStockLevel - item.availableStock,
            0,
          ),
          stockStatus: item.stockStatus,
          lastReceivedAt: item.lastReceivedAt,
        }));

      // Worst shortfall first — that is what needs ordering today.
      const sorted = sortBy(items, (item) => item.shortfall, "desc");
      return limit ? sorted.slice(0, limit) : sorted;
    }),

  listBatches: (filters = {}) =>
    mockRequest(() => {
      const batches = applyBatchFilters(filters);
      const direction = filters.sortDir ?? "asc";

      const sorted =
        filters.sortBy === "quantityRemaining"
          ? sortBy(batches, (batch) => batch.quantityRemaining, direction)
          : filters.sortBy === "product"
            ? sortBy(batches, (batch) => batch.product?.name ?? "", direction)
            : filters.sortBy === "receivedAt"
              ? sortBy(batches, (batch) => batch.receivedAt, direction)
              : // Default: soonest expiry first, which is also FEFO order.
                sortBy(batches, (batch) => batch.expiryDate, direction);

      return paginate(sorted, filters);
    }),

  getBatchesForProduct: (productId) =>
    mockRequest(() => batchesForProduct(productId).map(refreshBatchExpiry)),

  getExpiryAlerts: (limit = 8) =>
    mockRequest(() => {
      const alerts = db.batches
        .map(refreshBatchExpiry)
        .filter(
          (batch) => batch.quantityRemaining > 0 && batch.daysUntilExpiry <= 90,
        )
        .map(toExpiryAlert);

      return sortBy(alerts, (alert) => alert.daysUntilExpiry, "asc").slice(
        0,
        limit,
      );
    }),

  listExpiring: (filters = {}) =>
    mockRequest(() => {
      const alerts = applyBatchFilters({ ...filters, onlyInStock: true }).map(
        toExpiryAlert,
      );

      const direction = filters.sortDir ?? "asc";
      const sorted =
        filters.sortBy === "quantity"
          ? sortBy(alerts, (alert) => alert.quantityRemaining, direction)
          : filters.sortBy === "stockValue"
            ? sortBy(alerts, (alert) => alert.stockValue, direction)
            : sortBy(alerts, (alert) => alert.daysUntilExpiry, direction);

      return paginate(sorted, filters);
    }),

  getExpirySummary: () =>
    mockRequest(() => {
      const summary = Object.fromEntries(
        EXPIRY_STATUS_ORDER.map((status) => [status, 0]),
      ) as ExpirySummary;

      for (const batch of db.batches) {
        if (batch.quantityRemaining <= 0) continue;
        summary[deriveExpiryStatus(daysUntil(batch.expiryDate))] += 1;
      }

      return summary;
    }),

  listMovements: (filters = {}) =>
    mockRequest(() => {
      const movements = db.movements.filter((movement) => {
        // Compare on the calendar day, the same way the report summary does.
        // Comparing raw ISO strings would bucket a late-evening movement into
        // the previous day in WAT, and the list would then disagree with the
        // totals printed above it.
        const day = timestampToDateOnly(movement.createdAt);
        return (
          (!filters.productId || movement.productId === filters.productId) &&
          (!filters.batchId || movement.batchId === filters.batchId) &&
          (!filters.movementType ||
            movement.movementType === filters.movementType) &&
          (!filters.userId || movement.userId === filters.userId) &&
          (!filters.from || day >= filters.from) &&
          (!filters.to || day <= filters.to) &&
          matchesSearch(
            filters.search,
            movement.productName,
            movement.batchNumber,
            movement.userName,
          )
        );
      });

      // Newest first — a ledger is read from the top.
      return paginate(
        sortBy(movements, (movement) => movement.createdAt, "desc"),
        filters,
      );
    }),

  getRecentMovements: (limit = 6) =>
    mockRequest(() =>
      sortBy(db.movements, (movement) => movement.createdAt, "desc")
        .slice(0, limit)
        .map<RecentMovementSummary>((movement) => ({
          id: movement.id,
          productName: movement.productName,
          batchNumber: movement.batchNumber,
          movementType: movement.movementType,
          quantity: movement.quantity,
          userName: movement.userName,
          createdAt: movement.createdAt,
        })),
    ),
};

/* -------------------------------------------------------------------------
   HTTP adapter
   ------------------------------------------------------------------------- */

const httpInventoryService: InventoryService = {
  list: (filters) =>
    http.get<Paginated<InventoryItem>>("/inventory", { params: filters }),
  getSummary: () => http.get<InventorySummary>("/inventory/summary"),
  getLowStock: (limit) =>
    http.get<LowStockItem[]>("/inventory/low-stock", { params: { limit } }),
  listBatches: (filters) =>
    http.get<Paginated<Batch>>("/batches", { params: filters }),
  getBatchesForProduct: (productId) =>
    http.get<Batch[]>(`/products/${productId}/batches`),
  getExpiryAlerts: (limit) =>
    http.get<ExpiryAlertItem[]>("/inventory/expiry-alerts", {
      params: { limit },
    }),
  listExpiring: (filters) =>
    http.get<Paginated<ExpiryAlertItem>>("/inventory/expiring", {
      params: filters,
    }),
  getExpirySummary: () => http.get<ExpirySummary>("/inventory/expiry-summary"),
  listMovements: (filters) =>
    http.get<Paginated<StockMovement>>("/stock-movements", { params: filters }),
  getRecentMovements: (limit) =>
    http.get<RecentMovementSummary[]>("/stock-movements/recent", {
      params: { limit },
    }),
};

export const inventoryService: InventoryService = USE_MOCKS
  ? mockInventoryService
  : httpInventoryService;
