/**
 * Money.
 *
 * Every amount in this application is an INTEGER number of kobo (₦1 = 100 kobo).
 * Never a float. This removes rounding drift from cart totals, report sums and
 * change calculation entirely — `0.1 + 0.2` problems cannot occur on integers.
 *
 * Conversion to and from the API's representation happens once, at the HTTP
 * boundary (`lib/api/http.ts`), never in components.
 */

import type { Money } from "@/types/common";

const KOBO_PER_NAIRA = 100;

/** ₦1,500.00 → 150000 kobo. Rounds to the nearest kobo. */
export function nairaToKobo(naira: number): Money {
  return Math.round(naira * KOBO_PER_NAIRA);
}

/** 150000 kobo → 1500 naira (may be fractional; for display only). */
export function koboToNaira(kobo: Money): number {
  return kobo / KOBO_PER_NAIRA;
}

const nairaFormatter = new Intl.NumberFormat("en-NG", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const nairaWholeFormatter = new Intl.NumberFormat("en-NG", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/**
 * 150000 → "₦1,500.00"
 *
 * We format manually rather than using `style: "currency"` because Intl renders
 * NGN as "NGN 1,500.00" in several environments, and the pharmacy expects ₦.
 */
export function formatMoney(kobo: Money): string {
  const sign = kobo < 0 ? "-" : "";
  return `${sign}₦${nairaFormatter.format(Math.abs(kobo) / KOBO_PER_NAIRA)}`;
}

/** 150000 → "₦1,500" — for dense tables and stat cards where kobo is noise. */
export function formatMoneyCompact(kobo: Money): string {
  const sign = kobo < 0 ? "-" : "";
  const naira = Math.abs(kobo) / KOBO_PER_NAIRA;
  if (!Number.isInteger(naira)) return formatMoney(kobo);
  return `${sign}₦${nairaWholeFormatter.format(naira)}`;
}

/** Signed display for stock/ledger deltas: "+₦1,500" / "-₦1,500". */
export function formatMoneySigned(kobo: Money): string {
  if (kobo === 0) return formatMoney(0);
  return `${kobo > 0 ? "+" : ""}${formatMoney(kobo)}`;
}

/** Sum of a line: unit price × quantity, in kobo. Stays integral. */
export function lineTotal(unitPrice: Money, quantity: number): Money {
  return unitPrice * Math.trunc(quantity);
}

/** Total of many amounts, in kobo. */
export function sumMoney(amounts: readonly Money[]): Money {
  return amounts.reduce((total, amount) => total + amount, 0);
}

/**
 * Parse free-form user input ("1,500", "1500.50", "₦1,500") into kobo.
 * Returns null when the input is not a usable amount.
 */
export function parseMoneyInput(input: string): Money | null {
  const cleaned = input.replace(/[₦,\s]/g, "").trim();
  if (cleaned === "") return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) return null;
  return nairaToKobo(value);
}

/** Percentage margin between cost and selling price, or null if not derivable. */
export function marginPercent(cost: Money, selling: Money): number | null {
  if (cost <= 0 || selling <= 0) return null;
  return ((selling - cost) / cost) * 100;
}

/** 18340 → "18,340" — quantities, never money. */
export function formatQuantity(value: number): string {
  return new Intl.NumberFormat("en-NG").format(value);
}
