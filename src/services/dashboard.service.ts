/**
 * Dashboard aggregates.
 *
 * The server does the counting. These figures are computed across the whole
 * dataset, so the frontend must never fetch a table and total it itself.
 */

import { USE_MOCKS } from "@/lib/api/config";
import { http } from "@/lib/api/http";
import { addDays, timestampToDateOnly, today } from "@/lib/date";
import { db } from "@/mocks/db";
import { mockRequest } from "@/mocks/latency";
import { PAYMENT_METHODS } from "@/lib/status";
import type {
  DashboardSummary,
  PaymentMixEntry,
  SalesTrendPoint,
} from "@/types/analytics";
import type { Sale } from "@/types/domain";
import { inventoryService } from "./inventory.service";

export interface DashboardService {
  getSummary(): Promise<DashboardSummary>;
  getSalesTrend(days: number): Promise<SalesTrendPoint[]>;
  getPaymentMix(days: number): Promise<PaymentMixEntry[]>;
}

/* -------------------------------------------------------------------------
   Mock adapter
   ------------------------------------------------------------------------- */

/** Sales that count towards revenue — a fully reversed sale does not. */
function billableSales(): Sale[] {
  return db.sales.filter((sale) => sale.status !== "REVERSED");
}

function totalFor(day: string): { total: number; count: number } {
  const sales = billableSales().filter(
    (sale) => timestampToDateOnly(sale.createdAt) === day,
  );
  return {
    total: sales.reduce((sum, sale) => sum + sale.total, 0),
    count: sales.length,
  };
}

const axisLabel = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
});

const mockDashboardService: DashboardService = {
  getSummary: async () => {
    const inventory = await inventoryService.getSummary();

    return mockRequest(() => {
      const now = today();
      const todayFigures = totalFor(now);
      const yesterdayFigures = totalFor(addDays(now, -1));

      return {
        todaySales: todayFigures.total,
        todayTransactions: todayFigures.count,
        todayAverageSale:
          todayFigures.count > 0
            ? Math.round(todayFigures.total / todayFigures.count)
            : 0,
        // Null rather than a misleading 100% when yesterday had no takings.
        salesChangePercent:
          yesterdayFigures.total > 0
            ? ((todayFigures.total - yesterdayFigures.total) /
                yesterdayFigures.total) *
              100
            : null,
        inventory,
      } satisfies DashboardSummary;
    });
  },

  getSalesTrend: (days) =>
    mockRequest(() => {
      const now = today();
      const points: SalesTrendPoint[] = [];

      for (let offset = days - 1; offset >= 0; offset -= 1) {
        const date = addDays(now, -offset);
        const figures = totalFor(date);
        points.push({
          date,
          label: axisLabel.format(new Date(`${date}T12:00:00`)),
          total: figures.total,
          transactions: figures.count,
        });
      }

      return points;
    }),

  getPaymentMix: (days) =>
    mockRequest(() => {
      const from = addDays(today(), -(days - 1));
      const sales = billableSales().filter(
        (sale) => timestampToDateOnly(sale.createdAt) >= from,
      );

      const grandTotal = sales.reduce((sum, sale) => sum + sale.total, 0);

      return PAYMENT_METHODS.map<PaymentMixEntry>((method) => {
        const forMethod = sales.filter((sale) => sale.paymentMethod === method);
        const total = forMethod.reduce((sum, sale) => sum + sale.total, 0);
        return {
          method,
          total,
          transactions: forMethod.length,
          share: grandTotal > 0 ? total / grandTotal : 0,
        };
      });
    }),
};

/* -------------------------------------------------------------------------
   HTTP adapter
   ------------------------------------------------------------------------- */

const httpDashboardService: DashboardService = {
  getSummary: () => http.get<DashboardSummary>("/reports/dashboard"),
  getSalesTrend: (days) =>
    http.get<SalesTrendPoint[]>("/reports/sales-trend", { params: { days } }),
  getPaymentMix: (days) =>
    http.get<PaymentMixEntry[]>("/reports/payment-mix", { params: { days } }),
};

export const dashboardService: DashboardService = USE_MOCKS
  ? mockDashboardService
  : httpDashboardService;
