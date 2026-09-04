import { formatMoney } from "@/lib/money";
import type { AuditLog } from "@/types/domain";

/**
 * Rendering audited values.
 *
 * Audit entries carry loosely-typed snapshots, so formatting is driven by the
 * field name. Shared by the log table and the detail drawer: when only the
 * drawer knew that `sellingPrice` was kobo, the table printed a price change
 * as "95,000" beside a drawer that correctly said "₦950.00".
 */

/** Fields stored in integer kobo, matched loosely on the key name. */
const MONEY_KEYS = new Set([
  "sellingprice",
  "costprice",
  "unitprice",
  "total",
  "subtotal",
  "discount",
  "refundamount",
  "amountreceived",
  "changegiven",
  "stockvalue",
]);

function isMoneyKey(key: string): boolean {
  return MONEY_KEYS.has(key.toLowerCase().replace(/[_\s-]/g, ""));
}

/** `sellingPrice` → "Selling price" */
export function humanise(key: string): string {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Format one audited value, using the key to decide whether it is money. */
export function formatAuditValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") {
    return isMoneyKey(key)
      ? formatMoney(value)
      : new Intl.NumberFormat("en-NG").format(value);
  }
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

/** A one-line gist of the change, for the log table's Details column. */
export function summariseChange(entry: AuditLog): string | null {
  const source = entry.newValue ?? entry.oldValue;
  if (!source) return null;

  const summary = Object.entries(source)
    .slice(0, 3)
    .map(([key, value]) => `${humanise(key)}: ${formatAuditValue(key, value)}`)
    .join(" · ");

  return summary || null;
}
