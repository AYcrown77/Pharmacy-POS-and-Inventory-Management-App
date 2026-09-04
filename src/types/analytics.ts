/**
 * Aggregate view models.
 *
 * These are things the server computes across many rows — counts, totals,
 * trends. They are not entities, and the frontend never derives them from a
 * full table it fetched itself; that would not survive a real catalogue.
 */

import type { DateOnly, Money, Timestamp } from "./common";
import type {
  ExpiryStatus,
  MovementType,
  PaymentMethod,
  SaleStatus,
  StockStatus,
} from "./domain";

export interface InventorySummary {
  totalProducts: number;
  totalStockUnits: number;
  inventoryValue: Money;
  lowStockCount: number;
  outOfStockCount: number;
  expiringSoonCount: number;
  expiredCount: number;
}

export interface DashboardSummary {
  todaySales: Money;
  todayTransactions: number;
  todayAverageSale: Money;
  /** Change against yesterday's takings; null when yesterday had none. */
  salesChangePercent: number | null;
  inventory: InventorySummary;
}

export interface SalesTrendPoint {
  date: DateOnly;
  /** Pre-formatted axis label, so the chart does no date maths. */
  label: string;
  total: Money;
  transactions: number;
}

export interface PaymentMixEntry {
  method: PaymentMethod;
  total: Money;
  transactions: number;
  /** 0–1. */
  share: number;
}

export interface LowStockItem {
  productId: string;
  productName: string;
  categoryName: string | null;
  availableStock: number;
  minimumStockLevel: number;
  /** How many units short of the minimum. */
  shortfall: number;
  stockStatus: StockStatus;
  lastReceivedAt: Timestamp | null;
}

export interface ExpiryAlertItem {
  batchId: string;
  productId: string;
  productName: string;
  batchNumber: string;
  quantityRemaining: number;
  expiryDate: DateOnly;
  daysUntilExpiry: number;
  expiryStatus: ExpiryStatus;
  stockValue: Money;
}

/** Counts per expiry band, used by the dashboard and the expiry page. */
export type ExpirySummary = Record<ExpiryStatus, number>;

export interface RecentSaleSummary {
  id: string;
  receiptNumber: string;
  cashierName: string;
  itemCount: number;
  total: Money;
  paymentMethod: PaymentMethod;
  status: SaleStatus;
  createdAt: Timestamp;
}

/* -------------------------------------------------------------------------
   Report aggregates
   ------------------------------------------------------------------------- */

export interface SalesReportSummary {
  grossSales: Money;
  transactionCount: number;
  averageSale: Money;
  byMethod: PaymentMixEntry[];
  /** Refunds recorded in the same period, shown against gross takings. */
  refundedAmount: Money;
  refundCount: number;
}

export interface CashierReportRow {
  cashierId: string;
  cashierName: string;
  transactions: number;
  cashSales: Money;
  cardSales: Money;
  transferSales: Money;
  totalSales: Money;
  averageSale: Money;
}

export interface MovementReportSummary {
  movementCount: number;
  unitsIn: number;
  unitsOut: number;
  /** Positive when the period added more stock than it removed. */
  netUnits: number;
}

export interface RecentMovementSummary {
  id: string;
  productName: string;
  batchNumber: string | null;
  movementType: MovementType;
  quantity: number;
  userName: string;
  createdAt: Timestamp;
}
