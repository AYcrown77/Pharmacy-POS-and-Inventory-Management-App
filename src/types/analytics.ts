/**
 * Aggregate view models.
 *
 * These are things the server computes across many rows — counts, totals,
 * trends. They are not entities, and the frontend never derives them from a
 * full table it fetched itself; that would not survive a real catalogue.
 */

import type { DateOnly, Money, Timestamp } from "./common";
import type {
  Customer,
  ExpenseCategory,
  ExpiryStatus,
  MovementType,
  PaymentMethod,
  SalePaymentMethod,
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

/** Money handed over as goods and not yet paid for. */
export interface DebtSummary {
  totalOwed: Money;
  accountsOwing: number;
}

export interface DebtorRow {
  customerId: string;
  customerName: string;
  phone: string | null;
  balance: Money;
  /** Days since money last came in against this account. */
  daysSinceLastPayment: number | null;
  lastActivityAt: Timestamp | null;
}

export interface DashboardSummary {
  todaySales: Money;
  todayTransactions: number;
  todayAverageSale: Money;
  /** Change against yesterday's takings; null when yesterday had none. */
  salesChangePercent: number | null;
  inventory: InventorySummary;
  debt: DebtSummary;
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
  paymentMethod: SalePaymentMethod;
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
  /**
   * Sales rung up on these dates and since fully returned: left out of gross
   * sales, but added back in the takings sum because their refunds count.
   */
  returnedSalesTotal: Money;
  /** Debt taken: goods handed over on account on these dates, not yet paid for. */
  creditSales: Money;
  /** Debt paid back: money in against earlier debts — not a sale, but in the drawer. */
  debtCollected: Money;
  /** Returned goods that cleared debt rather than being paid out. */
  debtCleared: Money;
  /** Refunds handed back as money: returns less the debt they cleared. */
  refundsPaidOut: Money;
  /** Every entry behind the debt figures, newest first. */
  debtActivity: DebtActivity;
  /** Recorded (not voided) expenses on the same days. */
  expenses: ExpenseSummary;
  /**
   * What the period actually brought in: gross sales, plus sales since fully
   * returned, less debt taken, plus debt paid back, less refunds paid out, less
   * expenses — each counted on the date it happened.
   */
  netSales: Money;
}

export interface CashierReportRow {
  cashierId: string;
  cashierName: string;
  transactions: number;
  cashSales: Money;
  cardSales: Money;
  transferSales: Money;
  /** Taken on account rather than paid. */
  creditSales: Money;
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

/* -------------------------------------------------------------------------
   Expenses
   ------------------------------------------------------------------------- */

export interface ExpenseCategoryTotal {
  category: ExpenseCategory;
  total: Money;
  count: number;
}

export interface ExpenseSummary {
  total: Money;
  count: number;
  /** Largest first. */
  byCategory: ExpenseCategoryTotal[];
}

/* -------------------------------------------------------------------------
   Customer buying habits
   ------------------------------------------------------------------------- */

export interface CustomerProductHabit {
  productId: string;
  productName: string;
  /** Base units kept, returns taken off. */
  quantity: number;
  total: Money;
  /** How many separate purchases included it. */
  purchases: number;
}

export interface CustomerMonthSpend {
  /** YYYY-MM. */
  month: string;
  total: Money;
  purchases: number;
}

export interface CustomerRecentSale {
  id: string;
  receiptNumber: string;
  total: Money;
  refunded: Money;
  paymentMethod: SalePaymentMethod;
  status: SaleStatus;
  itemCount: number;
  createdAt: Timestamp;
}

export interface CustomerInsights {
  customer: Customer;
  /** Across sales not fully reversed, refunds taken off. */
  totalSpent: Money;
  purchaseCount: number;
  averageBasket: Money;
  firstPurchaseAt: Timestamp | null;
  lastPurchaseAt: Timestamp | null;
  /** Typical gap between visits; null until there are two purchases. */
  averageDaysBetweenPurchases: number | null;
  preferredPaymentMethod: SalePaymentMethod | null;
  takenOnAccount: Money;
  topProducts: CustomerProductHabit[];
  /** The last six months, oldest first, quiet months included. */
  monthly: CustomerMonthSpend[];
  recentSales: CustomerRecentSale[];
}

/* -------------------------------------------------------------------------
   Customer debt in a period
   ------------------------------------------------------------------------- */

/** One sale that put goods on a customer's account. */
export interface DebtTakenEntry {
  saleId: string;
  receiptNumber: string;
  customerId: string | null;
  customerName: string | null;
  amount: Money;
  recordedBy: string;
  /** REVERSED when the goods have since all come back. */
  status: SaleStatus;
  createdAt: Timestamp;
}

/** Money paid back, or debt cleared by a return. */
export interface DebtLedgerMovement {
  entryId: string;
  customerId: string;
  customerName: string;
  /** Always positive. */
  amount: Money;
  /** The sale it happened with: a surplus at the till, or a return. */
  saleId: string | null;
  receiptNumber: string | null;
  recordedBy: string;
  reason: string | null;
  createdAt: Timestamp;
}

export interface DebtActivity {
  taken: DebtTakenEntry[];
  paid: DebtLedgerMovement[];
  cleared: DebtLedgerMovement[];
}
