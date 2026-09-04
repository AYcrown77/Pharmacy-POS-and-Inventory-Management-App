/**
 * Sales.
 *
 * A sale is never deleted. Reversals are recorded separately (phase 6) and
 * change the sale's status in place, so there is no delete method here — and
 * there never should be.
 */

import { USE_MOCKS } from "@/lib/api/config";
import { ApiError, http } from "@/lib/api/http";
import { timestampToDateOnly } from "@/lib/date";
import { completeSale, db, type CompleteSaleInput } from "@/mocks/db";
import { matchesSearch, mockRequest, paginate, sortBy } from "@/mocks/latency";
import type { DateOnly, ListParams, Paginated } from "@/types/common";
import type { RecentSaleSummary } from "@/types/analytics";
import type { PaymentMethod, Sale, SaleStatus } from "@/types/domain";

export interface SaleFilters extends ListParams {
  from?: DateOnly;
  to?: DateOnly;
  cashierId?: string;
  paymentMethod?: PaymentMethod;
  status?: SaleStatus;
  terminalId?: string;
  /** Sales containing this product — powers the product's sales history. */
  productId?: string;
}

export interface SalesService {
  list(filters?: SaleFilters): Promise<Paginated<Sale>>;
  getById(id: string): Promise<Sale>;
  getByReceiptNumber(receiptNumber: string): Promise<Sale | null>;
  getRecent(limit?: number): Promise<RecentSaleSummary[]>;
  complete(input: CompleteSaleInput): Promise<Sale>;
}

/* -------------------------------------------------------------------------
   Mock adapter
   ------------------------------------------------------------------------- */

function filterSales(filters: SaleFilters): Sale[] {
  return db.sales.filter((sale) => {
    const day = timestampToDateOnly(sale.createdAt);
    return (
      (!filters.from || day >= filters.from) &&
      (!filters.to || day <= filters.to) &&
      (!filters.cashierId || sale.cashierId === filters.cashierId) &&
      (!filters.paymentMethod ||
        sale.paymentMethod === filters.paymentMethod) &&
      (!filters.status || sale.status === filters.status) &&
      (!filters.terminalId || sale.terminalId === filters.terminalId) &&
      (!filters.productId ||
        sale.items.some((item) => item.productId === filters.productId)) &&
      matchesSearch(
        filters.search,
        sale.receiptNumber,
        sale.cashierName,
        ...sale.items.map((item) => item.productName),
      )
    );
  });
}

const mockSalesService: SalesService = {
  list: (filters = {}) =>
    mockRequest(() => {
      const sales = filterSales(filters);
      const direction = filters.sortDir ?? "desc";

      const sorted =
        filters.sortBy === "total"
          ? sortBy(sales, (sale) => sale.total, direction)
          : filters.sortBy === "cashier"
            ? sortBy(sales, (sale) => sale.cashierName, direction)
            : filters.sortBy === "receiptNumber"
              ? sortBy(sales, (sale) => sale.receiptNumber, direction)
              : sortBy(sales, (sale) => sale.createdAt, direction);

      return paginate(sorted, filters);
    }),

  getById: (id) =>
    mockRequest(() => {
      const sale = db.sales.find((item) => item.id === id);
      if (!sale) throw new ApiError(404, "Sale not found.");
      return sale;
    }),

  getByReceiptNumber: (receiptNumber) =>
    mockRequest(() => {
      const needle = receiptNumber.trim().toUpperCase();
      return (
        db.sales.find(
          (sale) => sale.receiptNumber.toUpperCase() === needle,
        ) ?? null
      );
    }),

  getRecent: (limit = 6) =>
    mockRequest(() =>
      sortBy(db.sales, (sale) => sale.createdAt, "desc")
        .slice(0, limit)
        .map<RecentSaleSummary>((sale) => ({
          id: sale.id,
          receiptNumber: sale.receiptNumber,
          cashierName: sale.cashierName,
          itemCount: sale.items.reduce(
            (total, item) => total + item.quantity,
            0,
          ),
          total: sale.total,
          paymentMethod: sale.paymentMethod,
          status: sale.status,
          createdAt: sale.createdAt,
        })),
    ),

  complete: (input) => mockRequest(() => completeSale(input)),
};

/* -------------------------------------------------------------------------
   HTTP adapter
   ------------------------------------------------------------------------- */

const httpSalesService: SalesService = {
  list: (filters) => http.get<Paginated<Sale>>("/sales", { params: filters }),
  getById: (id) => http.get<Sale>(`/sales/${id}`),
  getByReceiptNumber: (receiptNumber) =>
    http.get<Sale | null>(
      `/sales/receipt/${encodeURIComponent(receiptNumber)}`,
    ),
  getRecent: (limit) =>
    http.get<RecentSaleSummary[]>("/sales/recent", { params: { limit } }),
  complete: (input) => http.post<Sale>("/sales", input),
};

export const salesService: SalesService = USE_MOCKS
  ? mockSalesService
  : httpSalesService;
