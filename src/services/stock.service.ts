/**
 * Stock receiving and adjustments.
 *
 * Both are writes that must leave a trail: each one creates a stock movement
 * and an audit entry alongside the change itself. Stock is never edited in
 * place without a recorded reason (§22 of the specification).
 */

import { USE_MOCKS } from "@/lib/api/config";
import { http } from "@/lib/api/http";
import {
  adjustStock,
  db,
  receiveStock,
  type AdjustStockInput,
  type ReceiveStockInput,
} from "@/mocks/db";
import { matchesSearch, mockRequest, paginate, sortBy } from "@/mocks/latency";
import type { ListParams, Paginated } from "@/types/common";
import type { AdjustmentReason, Batch, StockAdjustment } from "@/types/domain";

export interface AdjustmentFilters extends ListParams {
  productId?: string;
  reason?: AdjustmentReason;
  userId?: string;
}

export interface StockService {
  receive(input: ReceiveStockInput): Promise<Batch>;
  adjust(input: AdjustStockInput): Promise<StockAdjustment>;
  listAdjustments(
    filters?: AdjustmentFilters,
  ): Promise<Paginated<StockAdjustment>>;
  /** Distinct supplier names already used, for the receiving form's datalist. */
  listSuppliers(): Promise<string[]>;
}

/* -------------------------------------------------------------------------
   Mock adapter
   ------------------------------------------------------------------------- */

const mockStockService: StockService = {
  receive: (input) => mockRequest(() => receiveStock(input)),

  adjust: (input) => mockRequest(() => adjustStock(input)),

  listAdjustments: (filters = {}) =>
    mockRequest(() => {
      const adjustments = db.adjustments.filter(
        (adjustment) =>
          (!filters.productId || adjustment.productId === filters.productId) &&
          (!filters.reason || adjustment.reason === filters.reason) &&
          (!filters.userId || adjustment.performedBy === filters.userId) &&
          matchesSearch(
            filters.search,
            adjustment.productName,
            adjustment.batchNumber,
            adjustment.performedByName,
            adjustment.notes,
          ),
      );

      return paginate(
        sortBy(adjustments, (adjustment) => adjustment.createdAt, "desc"),
        filters,
      );
    }),

  listSuppliers: () =>
    mockRequest(() => {
      const names = new Set<string>();
      for (const batch of db.batches) {
        if (batch.supplierName) names.add(batch.supplierName);
      }
      return [...names].sort((a, b) => a.localeCompare(b));
    }),
};

/* -------------------------------------------------------------------------
   HTTP adapter
   ------------------------------------------------------------------------- */

const httpStockService: StockService = {
  receive: (input) => http.post<Batch>("/stock/receive", input),
  adjust: (input) => http.post<StockAdjustment>("/stock/adjustments", input),
  listAdjustments: (filters) =>
    http.get<Paginated<StockAdjustment>>("/stock/adjustments", {
      params: filters,
    }),
  listSuppliers: () => http.get<string[]>("/suppliers"),
};

export const stockService: StockService = USE_MOCKS
  ? mockStockService
  : httpStockService;

export type { AdjustStockInput, ReceiveStockInput };
