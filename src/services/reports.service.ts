/**
 * Report aggregates.
 *
 * These figures are computed across the whole dataset for a period, which is
 * the server's job. The frontend never totals a page of rows and calls it a
 * report — that would silently understate every figure past page one.
 */

import { USE_MOCKS } from "@/lib/api/config";
import { http } from "@/lib/api/http";
import { timestampToDateOnly } from "@/lib/date";
import { db } from "@/mocks/db";
import { mockRequest } from "@/mocks/latency";
import { PAYMENT_METHODS } from "@/lib/status";
import type { DateOnly, DateRange, Money } from "@/types/common";
import type {
  CashierReportRow,
  MovementReportSummary,
  PaymentMixEntry,
  SalesReportSummary,
  SalesTrendPoint,
} from "@/types/analytics";
import type { MovementType, PaymentMethod, Sale } from "@/types/domain";

export interface SalesReportFilters extends DateRange {
  cashierId?: string;
  paymentMethod?: PaymentMethod;
}

export interface MovementReportFilters extends Partial<DateRange> {
  productId?: string;
  movementType?: MovementType;
  userId?: string;
}

export interface ReportsService {
  salesSummary(filters: SalesReportFilters): Promise<SalesReportSummary>;
  salesTrend(filters: SalesReportFilters): Promise<SalesTrendPoint[]>;
  cashierReport(range: DateRange): Promise<CashierReportRow[]>;
  movementSummary(
    filters: MovementReportFilters,
  ): Promise<MovementReportSummary>;
}

/* -------------------------------------------------------------------------
   Mock adapter
   ------------------------------------------------------------------------- */

/** A reversed sale contributed nothing, so it is excluded from takings. */
function salesInRange(filters: SalesReportFilters): Sale[] {
  return db.sales.filter((sale) => {
    const day = timestampToDateOnly(sale.createdAt);
    return (
      sale.status !== "REVERSED" &&
      day >= filters.from &&
      day <= filters.to &&
      (!filters.cashierId || sale.cashierId === filters.cashierId) &&
      (!filters.paymentMethod || sale.paymentMethod === filters.paymentMethod)
    );
  });
}

function sumTotals(sales: Sale[]): Money {
  return sales.reduce((total, sale) => total + sale.total, 0);
}

const axisLabel = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
});

const mockReportsService: ReportsService = {
  salesSummary: (filters) =>
    mockRequest(() => {
      const sales = salesInRange(filters);
      const grossSales = sumTotals(sales);

      const byMethod = PAYMENT_METHODS.map<PaymentMixEntry>((method) => {
        const forMethod = sales.filter((sale) => sale.paymentMethod === method);
        const total = sumTotals(forMethod);
        return {
          method,
          total,
          transactions: forMethod.length,
          share: grossSales > 0 ? total / grossSales : 0,
        };
      });

      const refunds = db.returns.filter((entry) => {
        const day = timestampToDateOnly(entry.createdAt);
        return day >= filters.from && day <= filters.to;
      });

      return {
        grossSales,
        transactionCount: sales.length,
        averageSale:
          sales.length > 0 ? Math.round(grossSales / sales.length) : 0,
        byMethod,
        refundedAmount: refunds.reduce(
          (total, entry) => total + entry.refundAmount,
          0,
        ),
        refundCount: refunds.length,
      } satisfies SalesReportSummary;
    }),

  salesTrend: (filters) =>
    mockRequest(() => {
      const sales = salesInRange(filters);
      const byDay = new Map<DateOnly, { total: Money; count: number }>();

      for (const sale of sales) {
        const day = timestampToDateOnly(sale.createdAt);
        const entry = byDay.get(day) ?? { total: 0, count: 0 };
        entry.total += sale.total;
        entry.count += 1;
        byDay.set(day, entry);
      }

      return [...byDay.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map<SalesTrendPoint>(([date, entry]) => ({
          date,
          label: axisLabel.format(new Date(`${date}T12:00:00`)),
          total: entry.total,
          transactions: entry.count,
        }));
    }),

  cashierReport: (range) =>
    mockRequest(() => {
      const sales = salesInRange(range);

      // Every active cashier appears, including those who took nothing —
      // a blank row is itself information on a shift report.
      const cashiers = db.users.filter(
        (user) => user.role === "CASHIER" || user.role === "ADMINISTRATOR",
      );

      const rows = cashiers.map<CashierReportRow>((cashier) => {
        const own = sales.filter((sale) => sale.cashierId === cashier.id);
        const forMethod = (method: PaymentMethod) =>
          sumTotals(own.filter((sale) => sale.paymentMethod === method));

        const totalSales = sumTotals(own);

        return {
          cashierId: cashier.id,
          cashierName: cashier.name,
          transactions: own.length,
          cashSales: forMethod("CASH"),
          cardSales: forMethod("CARD"),
          transferSales: forMethod("TRANSFER"),
          totalSales,
          averageSale:
            own.length > 0 ? Math.round(totalSales / own.length) : 0,
        };
      });

      return rows
        .filter((row) => row.transactions > 0)
        .sort((a, b) => b.totalSales - a.totalSales);
    }),

  movementSummary: (filters) =>
    mockRequest(() => {
      const movements = db.movements.filter((movement) => {
        const day = timestampToDateOnly(movement.createdAt);
        return (
          (!filters.from || day >= filters.from) &&
          (!filters.to || day <= filters.to) &&
          (!filters.productId || movement.productId === filters.productId) &&
          (!filters.movementType ||
            movement.movementType === filters.movementType) &&
          (!filters.userId || movement.userId === filters.userId)
        );
      });

      const unitsIn = movements
        .filter((movement) => movement.quantity > 0)
        .reduce((total, movement) => total + movement.quantity, 0);

      const unitsOut = movements
        .filter((movement) => movement.quantity < 0)
        .reduce((total, movement) => total + Math.abs(movement.quantity), 0);

      return {
        movementCount: movements.length,
        unitsIn,
        unitsOut,
        netUnits: unitsIn - unitsOut,
      } satisfies MovementReportSummary;
    }),
};

/* -------------------------------------------------------------------------
   HTTP adapter
   ------------------------------------------------------------------------- */

const httpReportsService: ReportsService = {
  salesSummary: (filters) =>
    http.get<SalesReportSummary>("/reports/sales/summary", { params: filters }),
  salesTrend: (filters) =>
    http.get<SalesTrendPoint[]>("/reports/sales/trend", { params: filters }),
  cashierReport: (range) =>
    http.get<CashierReportRow[]>("/reports/cashiers", { params: range }),
  movementSummary: (filters) =>
    http.get<MovementReportSummary>("/reports/stock-movements/summary", {
      params: filters,
    }),
};

export const reportsService: ReportsService = USE_MOCKS
  ? mockReportsService
  : httpReportsService;
