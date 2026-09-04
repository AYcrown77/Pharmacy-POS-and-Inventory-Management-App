/**
 * Returns and sale reversals.
 *
 * A sale is never deleted. A return creates its own record, puts the stock
 * back in the batch it came from, and moves the sale's status to partially
 * returned or reversed (§23).
 */

import { USE_MOCKS } from "@/lib/api/config";
import { http } from "@/lib/api/http";
import { db, processReturn, type ProcessReturnInput } from "@/mocks/db";
import { matchesSearch, mockRequest, paginate, sortBy } from "@/mocks/latency";
import type { ListParams, Paginated } from "@/types/common";
import type { SaleReturn } from "@/types/domain";

export interface ReturnFilters extends ListParams {
  saleId?: string;
  processedBy?: string;
}

export interface ReturnsService {
  process(input: ProcessReturnInput): Promise<SaleReturn>;
  list(filters?: ReturnFilters): Promise<Paginated<SaleReturn>>;
  /** Reversal history for one sale. */
  forSale(saleId: string): Promise<SaleReturn[]>;
}

const mockReturnsService: ReturnsService = {
  process: (input) => mockRequest(() => processReturn(input)),

  list: (filters = {}) =>
    mockRequest(() => {
      const returns = db.returns.filter(
        (entry) =>
          (!filters.saleId || entry.saleId === filters.saleId) &&
          (!filters.processedBy || entry.processedBy === filters.processedBy) &&
          matchesSearch(
            filters.search,
            entry.receiptNumber,
            entry.reason,
            entry.processedByName,
          ),
      );

      return paginate(
        sortBy(returns, (entry) => entry.createdAt, "desc"),
        filters,
      );
    }),

  forSale: (saleId) =>
    mockRequest(() =>
      sortBy(
        db.returns.filter((entry) => entry.saleId === saleId),
        (entry) => entry.createdAt,
        "desc",
      ),
    ),
};

const httpReturnsService: ReturnsService = {
  process: (input) => http.post<SaleReturn>("/returns", input),
  list: (filters) =>
    http.get<Paginated<SaleReturn>>("/returns", { params: filters }),
  forSale: (saleId) => http.get<SaleReturn[]>(`/sales/${saleId}/returns`),
};

export const returnsService: ReturnsService = USE_MOCKS
  ? mockReturnsService
  : httpReturnsService;

export type { ProcessReturnInput };
