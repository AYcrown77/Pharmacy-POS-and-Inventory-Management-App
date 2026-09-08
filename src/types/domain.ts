/**
 * Domain model.
 *
 * These types mirror the database structure in §25 of the MVP specification,
 * shaped as the REST API will return them. The mock adapters and the future
 * Express client both satisfy exactly these shapes.
 */

import type { DateOnly, Money, Timestamp } from "./common";

/* -------------------------------------------------------------------------
   Enumerations — every status string in the app is one of these unions.
   No status is ever written as a bare string in a component.
   ------------------------------------------------------------------------- */

export type Role = "ADMINISTRATOR" | "CASHIER";

export type PaymentMethod = "CASH" | "CARD" | "TRANSFER";

/**
 * The three prices a product carries.
 *
 * A pharmacy sells the same pack to a walk-in customer, a corner shop and a
 * distributor at different prices. The sale records which list it charged, so
 * a later price edit cannot change what an old receipt appears to have said.
 */
export type PriceTier = "WHOLESALE" | "RETAIL" | "CONSUMER";

/**
 * Which unit a tier trades in.
 *
 * A walk-in buys a single; a shop or distributor buys the pack. The tier
 * decides both the price and what "1" means, so the two cannot drift apart.
 * Stock is always counted in singles — a pack sale just deducts more of them.
 */
export const TIER_SELLS_PACKS: Record<PriceTier, boolean> = {
  WHOLESALE: true,
  RETAIL: true,
  CONSUMER: false,
};

export type SaleStatus = "COMPLETED" | "PARTIALLY_RETURNED" | "REVERSED";

export type StockStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";

/** Expiry bands from §20 of the specification. */
export type ExpiryStatus =
  | "EXPIRED"
  | "CRITICAL_30"
  | "WARNING_60"
  | "NOTICE_90"
  | "HEALTHY";

export type MovementType =
  | "STOCK_RECEIVED"
  | "SALE"
  | "RETURN"
  | "DAMAGE"
  | "EXPIRY"
  | "ADJUSTMENT";

export type AdjustmentReason =
  | "EXPIRED"
  | "DAMAGED"
  | "MISSING"
  | "COUNT_CORRECTION"
  | "RETURNED_TO_SUPPLIER"
  | "OTHER";

export type AuditAction =
  | "USER_LOGIN"
  | "USER_LOGOUT"
  | "PRODUCT_CREATED"
  | "PRODUCT_UPDATED"
  | "PRICE_CHANGED"
  | "STOCK_RECEIVED"
  | "STOCK_ADJUSTMENT"
  | "SALE_COMPLETED"
  | "SALE_REVERSAL"
  | "USER_CREATED"
  | "USER_UPDATED"
  | "USER_DISABLED"
  | "USER_ENABLED"
  | "SETTINGS_UPDATED";

export type TerminalType = "CHECKOUT" | "DISPENSING" | "ADMIN";

export type UnitType =
  | "PACK"
  | "BOTTLE"
  | "TABLET"
  | "SACHET"
  | "TUBE"
  | "VIAL"
  | "CARTON"
  | "PIECE";

export type DosageForm =
  | "TABLET"
  | "CAPSULE"
  | "SYRUP"
  | "SUSPENSION"
  | "INJECTION"
  | "CREAM"
  | "OINTMENT"
  | "DROPS"
  | "INHALER"
  | "SUPPOSITORY"
  | "POWDER";

/* -------------------------------------------------------------------------
   Entities
   ------------------------------------------------------------------------- */

export interface User {
  id: string;
  name: string;
  username: string;
  role: Role;
  isActive: boolean;
  lastLoginAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
}

export interface Product {
  id: string;
  name: string;
  genericName: string | null;
  brandName: string | null;
  barcode: string | null;
  categoryId: string;
  category: Category | null;
  strength: string | null;
  dosageForm: DosageForm | null;
  priceWholesale: Money;
  priceRetail: Money;
  priceConsumer: Money;
  /**
   * How many of the smallest unit make up one pack. 1 means the product is
   * never broken down — a bottle, an inhaler — and pack and single are then
   * the same thing.
   */
  unitsPerPack: number;
  minimumStockLevel: number;
  unitType: UnitType;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * A physical lot of stock. Quantity lives here, never on the product —
 * a product's stock is the sum of its batches.
 */
export interface Batch {
  id: string;
  productId: string;
  product: Product | null;
  batchNumber: string;
  expiryDate: DateOnly;
  quantityReceived: number;
  quantityRemaining: number;
  costPrice: Money;
  sellingPrice: Money;
  supplierName: string | null;
  receivedAt: Timestamp;
  receivedBy: string;
  receivedByName: string;
  /** Derived by the server so every client bands expiry identically. */
  expiryStatus: ExpiryStatus;
  daysUntilExpiry: number;
}

/** Product-level stock, aggregated across batches. */
export interface InventoryItem {
  productId: string;
  product: Product;
  availableStock: number;
  minimumStockLevel: number;
  batchCount: number;
  nearestExpiry: DateOnly | null;
  stockStatus: StockStatus;
  expiryStatus: ExpiryStatus | null;
  stockValue: Money;
  lastReceivedAt: Timestamp | null;
}

export interface Terminal {
  id: string;
  name: string;
  location: string;
  type: TerminalType;
  isActive: boolean;
}

export interface Sale {
  id: string;
  receiptNumber: string;
  terminalId: string;
  terminalName: string;
  cashierId: string;
  cashierName: string;
  /** Null for a walk-in, which is most sales. */
  customerId: string | null;
  customerName: string | null;
  subtotal: Money;
  discount: Money;
  total: Money;
  paymentMethod: PaymentMethod;
  /** Which price list this sale was rung up at. */
  priceTier: PriceTier;
  /** Cash sales only. */
  amountReceived: Money | null;
  changeGiven: Money | null;
  status: SaleStatus;
  /** What this sale added to the customer's debt. */
  debtCharged: Money;
  /** What an overpayment took off an existing balance. */
  debtRepaid: Money;
  /**
   * The balance as it stood when the receipt printed. Stored rather than read
   * live, so a reprint shows what the customer was told at the time.
   */
  customerBalanceAfter: Money | null;
  items: SaleItem[];
  createdAt: Timestamp;
}

/**
 * One line of a sale. `batchId`/`batchNumber` record the batch the SERVER
 * actually allocated under FEFO — never a client-side guess.
 *
 * `unitPrice` is the price at the moment of sale, so changing a product's
 * price tomorrow does not rewrite yesterday's receipt (§25 of the spec).
 */
export interface SaleItem {
  id: string;
  saleId: string;
  productId: string;
  productName: string;
  batchId: string;
  batchNumber: string;
  quantity: number;
  /** Base units in one of this line's units — the pack size, or 1. */
  unitsPerSaleUnit: number;
  unitPrice: Money;
  subtotal: Money;
  returnedQuantity: number;
}

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  batchId: string | null;
  batchNumber: string | null;
  movementType: MovementType;
  /** Signed: positive adds stock, negative removes it. */
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  referenceType: string | null;
  referenceId: string | null;
  userId: string;
  userName: string;
  reason: string | null;
  createdAt: Timestamp;
}

export interface StockAdjustment {
  id: string;
  productId: string;
  productName: string;
  batchId: string;
  batchNumber: string;
  quantityBefore: number;
  /** Signed change applied to the batch. */
  adjustment: number;
  quantityAfter: number;
  reason: AdjustmentReason;
  notes: string | null;
  performedBy: string;
  performedByName: string;
  createdAt: Timestamp;
}

export interface SaleReturnItem {
  saleItemId: string;
  productId: string;
  productName: string;
  batchId: string;
  batchNumber: string;
  quantity: number;
  unitPrice: Money;
  refundAmount: Money;
}

export interface SaleReturn {
  id: string;
  saleId: string;
  receiptNumber: string;
  items: SaleReturnItem[];
  refundAmount: Money;
  refundMethod: PaymentMethod;
  reason: string;
  processedBy: string;
  processedByName: string;
  createdAt: Timestamp;
}

/** Someone who buys on account and can carry a balance. */
export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  note: string | null;
  /** Kobo owed to the pharmacy. Negative means they are in credit. */
  balance: Money;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type LedgerEntryType = "CHARGE" | "REPAYMENT" | "REVERSAL" | "ADJUSTMENT";

/**
 * One movement of a customer's balance.
 *
 * Append-only: a balance that was wrong is corrected with a further entry, so
 * both the error and the correction stay on the record.
 */
export interface CustomerLedgerEntry {
  id: string;
  customerId: string;
  entryType: LedgerEntryType;
  /** Signed kobo: positive increases the debt, negative reduces it. */
  amount: Money;
  balanceBefore: Money;
  balanceAfter: Money;
  saleId: string | null;
  receiptNumber: string | null;
  reason: string | null;
  userId: string;
  userName: string;
  createdAt: Timestamp;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: AuditAction;
  entityType: string;
  entityId: string | null;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  createdAt: Timestamp;
}

export interface PharmacySettings {
  name: string;
  address: string;
  phone: string;
  receiptFooter: string;
  showLogoOnReceipt: boolean;
  currency: "NGN";
  lowStockAlertsEnabled: boolean;
  expiryAlertDays: number;
}
