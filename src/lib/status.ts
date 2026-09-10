/**
 * Status presentation.
 *
 * Every status shown anywhere in the application resolves through this file:
 * a human label plus a semantic tone. Nothing hardcodes a status string or
 * picks a colour locally, so a badge means the same thing on every screen.
 *
 * Two rules from the specification are encoded here:
 *   · A routine SALE is neutral, not red. Stock leaving through the till is
 *     normal; only DAMAGE and EXPIRY are problems (§ stock movement report).
 *   · Status is never colour alone — every entry carries a word.
 */

import type {
  AdjustmentReason,
  AuditAction,
  DosageForm,
  ExpiryStatus,
  MovementType,
  PaymentMethod,
  Role,
  SaleStatus,
  StockStatus,
  TerminalType,
  UnitType,
} from "@/types/domain";

/** The semantic colour vocabulary. Badges, alerts and indicators share it. */
export type Tone =
  | "neutral"
  | "primary"
  | "success"
  | "warning"
  | "warning-muted"
  | "danger"
  | "danger-solid"
  | "info";

/* -------------------------------------------------------------------------
   Stock
   ------------------------------------------------------------------------- */

export const STOCK_STATUS_LABELS: Record<StockStatus, string> = {
  IN_STOCK: "In Stock",
  LOW_STOCK: "Low Stock",
  OUT_OF_STOCK: "Out of Stock",
};

export const STOCK_STATUS_TONES: Record<StockStatus, Tone> = {
  IN_STOCK: "success",
  LOW_STOCK: "warning",
  OUT_OF_STOCK: "danger",
};

/** Derive product-level stock status from quantity and its minimum level. */
export function deriveStockStatus(
  available: number,
  minimum: number,
): StockStatus {
  if (available <= 0) return "OUT_OF_STOCK";
  if (available <= minimum) return "LOW_STOCK";
  return "IN_STOCK";
}

/* -------------------------------------------------------------------------
   Expiry — bands from §20
   ------------------------------------------------------------------------- */

export const EXPIRY_STATUS_LABELS: Record<ExpiryStatus, string> = {
  EXPIRED: "Expired",
  CRITICAL_30: "Critical",
  WARNING_60: "Expiring Soon",
  NOTICE_90: "Watch",
  HEALTHY: "Healthy",
};

/** Longer phrasing for filter chips and report legends. */
export const EXPIRY_STATUS_RANGE_LABELS: Record<ExpiryStatus, string> = {
  EXPIRED: "Expired",
  CRITICAL_30: "0–30 days",
  WARNING_60: "31–60 days",
  NOTICE_90: "61–90 days",
  HEALTHY: "Healthy",
};

export const EXPIRY_STATUS_TONES: Record<ExpiryStatus, Tone> = {
  EXPIRED: "danger-solid", // strongest signal in the application
  CRITICAL_30: "danger",
  WARNING_60: "warning",
  NOTICE_90: "warning-muted",
  HEALTHY: "success",
};

/** Bands are ordered most-urgent first wherever they are listed. */
export const EXPIRY_STATUS_ORDER: readonly ExpiryStatus[] = [
  "EXPIRED",
  "CRITICAL_30",
  "WARNING_60",
  "NOTICE_90",
  "HEALTHY",
];

/** Band a batch by days remaining until its expiry date. */
export function deriveExpiryStatus(daysUntilExpiry: number): ExpiryStatus {
  if (daysUntilExpiry < 0) return "EXPIRED";
  if (daysUntilExpiry <= 30) return "CRITICAL_30";
  if (daysUntilExpiry <= 60) return "WARNING_60";
  if (daysUntilExpiry <= 90) return "NOTICE_90";
  return "HEALTHY";
}

/** Anything inside 90 days counts as "expiring soon" for dashboard counts. */
export function isExpiringSoon(status: ExpiryStatus): boolean {
  return (
    status === "CRITICAL_30" ||
    status === "WARNING_60" ||
    status === "NOTICE_90"
  );
}

/* -------------------------------------------------------------------------
   Stock movements
   ------------------------------------------------------------------------- */

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  STOCK_RECEIVED: "Received",
  SALE: "Sale",
  RETURN: "Return",
  DAMAGE: "Damage",
  EXPIRY: "Expiry",
  ADJUSTMENT: "Adjustment",
};

/**
 * A sale is deliberately neutral: stock leaving through the till is routine.
 * Colouring it red would drown the movements that are genuinely problems.
 */
export const MOVEMENT_TYPE_TONES: Record<MovementType, Tone> = {
  STOCK_RECEIVED: "success",
  SALE: "neutral",
  RETURN: "info",
  DAMAGE: "danger",
  EXPIRY: "danger",
  ADJUSTMENT: "warning",
};

/* -------------------------------------------------------------------------
   Sales, payment, roles
   ------------------------------------------------------------------------- */

export const SALE_STATUS_LABELS: Record<SaleStatus, string> = {
  COMPLETED: "Completed",
  PARTIALLY_RETURNED: "Partially Returned",
  REVERSED: "Reversed",
};

export const SALE_STATUS_TONES: Record<SaleStatus, Tone> = {
  COMPLETED: "success",
  PARTIALLY_RETURNED: "warning",
  REVERSED: "info",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Cash",
  CARD: "POS/Card",
  TRANSFER: "Bank Transfer",
};

/** Short form for dense table columns. */
export const PAYMENT_METHOD_SHORT_LABELS: Record<PaymentMethod, string> = {
  CASH: "Cash",
  CARD: "Card",
  TRANSFER: "Transfer",
};

export const PAYMENT_METHODS: readonly PaymentMethod[] = [
  "CASH",
  "CARD",
  "TRANSFER",
];

export const ROLE_LABELS: Record<Role, string> = {
  ADMINISTRATOR: "Administrator",
  CASHIER: "Cashier",
};

export const ROLE_TONES: Record<Role, Tone> = {
  ADMINISTRATOR: "primary",
  CASHIER: "info",
};

export const ROLES: readonly Role[] = ["ADMINISTRATOR", "CASHIER"];

export const TERMINAL_TYPE_LABELS: Record<TerminalType, string> = {
  CHECKOUT: "Checkout Terminal",
  DISPENSING: "Dispensing Terminal",
  ADMIN: "Admin Terminal",
};

/* -------------------------------------------------------------------------
   Adjustments & audit
   ------------------------------------------------------------------------- */

export const ADJUSTMENT_REASON_LABELS: Record<AdjustmentReason, string> = {
  EXPIRED: "Expired",
  DAMAGED: "Damaged",
  MISSING: "Missing",
  COUNT_CORRECTION: "Stock Count Correction",
  RETURNED_TO_SUPPLIER: "Returned to Supplier",
  OTHER: "Other",
};

export const ADJUSTMENT_REASONS: readonly AdjustmentReason[] = [
  "EXPIRED",
  "DAMAGED",
  "MISSING",
  "COUNT_CORRECTION",
  "RETURNED_TO_SUPPLIER",
  "OTHER",
];

/** Which movement type an adjustment reason records in the ledger. */
export const ADJUSTMENT_REASON_MOVEMENT: Record<
  AdjustmentReason,
  MovementType
> = {
  EXPIRED: "EXPIRY",
  DAMAGED: "DAMAGE",
  MISSING: "ADJUSTMENT",
  COUNT_CORRECTION: "ADJUSTMENT",
  RETURNED_TO_SUPPLIER: "ADJUSTMENT",
  OTHER: "ADJUSTMENT",
};

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  USER_LOGIN: "User Login",
  USER_LOGOUT: "User Logout",
  PRODUCT_CREATED: "Product Created",
  PRODUCT_UPDATED: "Product Updated",
  PRICE_CHANGED: "Price Changed",
  STOCK_RECEIVED: "Stock Received",
  STOCK_ADJUSTMENT: "Stock Adjustment",
  SALE_COMPLETED: "Sale Completed",
  SALE_REVERSAL: "Sale Reversal",
  USER_CREATED: "User Created",
  USER_UPDATED: "User Updated",
  USER_DISABLED: "User Disabled",
  USER_ENABLED: "User Enabled",
  SETTINGS_UPDATED: "Settings Updated",
};

/** Every action, newest-relevant first, for the audit log's filter. */
export const AUDIT_ACTIONS = Object.keys(
  AUDIT_ACTION_LABELS,
) as AuditAction[];

export const AUDIT_ACTION_TONES: Record<AuditAction, Tone> = {
  USER_LOGIN: "neutral",
  USER_LOGOUT: "neutral",
  PRODUCT_CREATED: "success",
  PRODUCT_UPDATED: "info",
  PRICE_CHANGED: "warning",
  STOCK_RECEIVED: "success",
  STOCK_ADJUSTMENT: "warning",
  SALE_COMPLETED: "neutral",
  SALE_REVERSAL: "danger",
  USER_CREATED: "success",
  USER_UPDATED: "info",
  USER_DISABLED: "danger",
  USER_ENABLED: "success",
  SETTINGS_UPDATED: "info",
};

/* -------------------------------------------------------------------------
   Product vocabulary
   ------------------------------------------------------------------------- */

export const UNIT_TYPE_LABELS: Record<UnitType, string> = {
  PACK: "Pack",
  BOTTLE: "Bottle",
  TABLET: "Tablet",
  CAPSULE: "Capsule",
  SACHET: "Sachet",
  TUBE: "Tube",
  VIAL: "Vial",
  CARTON: "Carton",
  PIECE: "Piece",
};

/**
 * The unit a quantity is counted in, ready to sit beside a number.
 *
 * A cashier reading "70 available" cannot tell whether that is seventy tablets
 * or seventy cartons of them, which is the difference between a sensible sale
 * and a wrong one. Every label pluralises with a plain -s.
 */
export function unitLabel(quantity: number, unitType: UnitType): string {
  const singular = UNIT_TYPE_LABELS[unitType].toLowerCase();
  return Math.abs(quantity) === 1 ? singular : `${singular}s`;
}

export const UNIT_TYPES: readonly UnitType[] = [
  "PACK",
  "BOTTLE",
  "TABLET",
  "CAPSULE",
  "SACHET",
  "TUBE",
  "VIAL",
  "CARTON",
  "PIECE",
];

/**
 * Units that are themselves a grouping of something else. A product that
 * comes in packs of more than one cannot have one of these as its base unit —
 * the base unit has to be what ONE of them is.
 */
export const GROUPING_UNIT_TYPES: readonly UnitType[] = ["PACK", "CARTON"];

export const DOSAGE_FORM_LABELS: Record<DosageForm, string> = {
  TABLET: "Tablet",
  CAPSULE: "Capsule",
  SYRUP: "Syrup",
  SUSPENSION: "Suspension",
  INJECTION: "Injection",
  CREAM: "Cream",
  OINTMENT: "Ointment",
  DROPS: "Drops",
  INHALER: "Inhaler",
  SUPPOSITORY: "Suppository",
  POWDER: "Powder",
};

export const DOSAGE_FORMS: readonly DosageForm[] = [
  "TABLET",
  "CAPSULE",
  "SYRUP",
  "SUSPENSION",
  "INJECTION",
  "CREAM",
  "OINTMENT",
  "DROPS",
  "INHALER",
  "SUPPOSITORY",
  "POWDER",
];
