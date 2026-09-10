import { lineTotal, sumMoney } from "@/lib/money";
import { UNIT_TYPE_LABELS } from "@/lib/status";
import type { SaleLookup } from "@/services/products.service";
import type { DateOnly, Money } from "@/types/common";
import { defaultUnitForTier, type PriceTier, type SaleUnit } from "@/types/domain";

/**
 * The cart.
 *
 * All the rules live in this reducer rather than scattered across handlers,
 * because the awkward cases — scanning the same product twice, hitting the
 * stock ceiling, a sale that fails at the server — are exactly where a till
 * loses a cashier's trust.
 *
 * Every price is for one base unit: a tablet, a sachet. A line counts either
 * singles or whole packs, and a pack is simply `unitsPerPack` base units at the
 * same unit price — so one product can sit in the cart twice, as a box and as
 * a few loose, with both lines drawing on the same shelf.
 */

export interface CartLine {
  /** `productId:unit` — a product can be in the cart as packs and as singles. */
  key: string;
  productId: string;
  productName: string;
  /** Shown under the name so the cashier can confirm the right product. */
  description: string | null;
  unit: SaleUnit;
  /** Base units in one of this line's units: the pack size, or 1. */
  unitsPerSaleUnit: number;
  /** Base units in a pack. 1 means the product is never broken down. */
  unitsPerPack: number;
  /** What one base unit is called, lower-case and singular: "tablet". */
  baseUnitName: string;
  /** The price of ONE base unit at each tier, so a tier switch needs no refetch. */
  unitPrices: Record<PriceTier, Money>;
  /**
   * What one of this line's units costs at the cart's tier. Always derived
   * from `unitPrices` — never set on its own, or the total on screen could
   * disagree with what the server charges.
   */
  unitPrice: Money;
  quantity: number;
  /** What the shelf held, in base units, at the last lookup. The server re-checks. */
  availableBase: number;
  /**
   * The batch FEFO is expected to draw from. Display only — the allocation
   * that counts is whatever the server returns with the completed sale.
   */
  expectedBatchNumber: string | null;
  expectedExpiry: DateOnly | null;
}

export interface CartState {
  lines: CartLine[];
  discount: Money;
  /**
   * One tier for the whole basket. A customer is a wholesaler or a walk-in,
   * not both mid-sale, and the server prices the entire sale at one tier — so
   * holding it per line would let the displayed total drift from the charge.
   */
  priceTier: PriceTier;
  /** Set briefly after a line changes, so the UI can flash that row. */
  lastTouchedKey: string | null;
}

export const emptyCart: CartState = {
  lines: [],
  discount: 0,
  priceTier: "CONSUMER",
  lastTouchedKey: null,
};

export type CartAction =
  | { type: "ADD"; lookup: SaleLookup; quantity?: number; unit?: SaleUnit }
  | { type: "SET_QUANTITY"; key: string; quantity: number }
  | { type: "ADJUST_QUANTITY"; key: string; delta: number }
  | { type: "SET_UNIT"; key: string; unit: SaleUnit }
  | { type: "REMOVE"; key: string }
  | { type: "SET_DISCOUNT"; discount: Money }
  | { type: "SET_PRICE_TIER"; priceTier: PriceTier }
  | { type: "CLEAR" }
  | { type: "RESTORE"; state: CartState };

export const lineKey = (productId: string, unit: SaleUnit): string =>
  `${productId}:${unit}`;

function lineFromLookup(
  lookup: SaleLookup,
  unit: SaleUnit,
  quantity: number,
  priceTier: PriceTier,
): CartLine {
  const nextBatch = lookup.sellableBatches[0] ?? null;
  const unitsPerPack = Math.max(lookup.product.unitsPerPack, 1);
  const unitsPerSaleUnit = unit === "PACK" ? unitsPerPack : 1;

  const unitPrices: Record<PriceTier, Money> = {
    WHOLESALE: lookup.product.priceWholesale,
    RETAIL: lookup.product.priceRetail,
    CONSUMER: lookup.product.priceConsumer,
  };

  return {
    key: lineKey(lookup.product.id, unit),
    productId: lookup.product.id,
    productName: lookup.product.name,
    description:
      [lookup.product.strength, lookup.product.brandName]
        .filter(Boolean)
        .join(" · ") || null,
    unit,
    unitsPerSaleUnit,
    unitsPerPack,
    baseUnitName: (UNIT_TYPE_LABELS[lookup.product.unitType] ?? "unit").toLowerCase(),
    unitPrices,
    unitPrice: unitPrices[priceTier] * unitsPerSaleUnit,
    quantity,
    availableBase: lookup.availableStock,
    expectedBatchNumber: nextBatch?.batchNumber ?? null,
    expectedExpiry: nextBatch?.expiryDate ?? null,
  };
}

/**
 * The most of this line's unit the shelf can still supply once every other
 * line of the same product has taken its share. Packs count whole: 30 tablets
 * left is one pack of 24, not one and a quarter.
 */
export function lineCeiling(lines: readonly CartLine[], line: CartLine): number {
  const heldElsewhere = lines
    .filter((other) => other.productId === line.productId && other.key !== line.key)
    .reduce((total, other) => total + other.quantity * other.unitsPerSaleUnit, 0);

  return Math.max(
    Math.floor((line.availableBase - heldElsewhere) / line.unitsPerSaleUnit),
    0,
  );
}

/**
 * The cart after switching a line to the other unit, or null when that is not
 * possible — the product has no pack, or the shelf cannot supply it.
 *
 * The count is kept: "2 packs" becomes "2 tablets". The cashier is correcting
 * which unit was meant, not converting a quantity — silently turning 2 packs
 * into 48 tablets would be the surprise. Nothing is quietly trimmed either: a
 * switch the shelf cannot cover is refused, and the button says so. When the
 * product is already in the cart in that unit, the two lines merge.
 */
export function switchLineUnit(
  lines: readonly CartLine[],
  key: string,
  unit: SaleUnit,
): CartLine[] | null {
  const line = lines.find((l) => l.key === key);
  if (!line || line.unitsPerPack <= 1 || line.unit === unit) return null;

  const targetKey = lineKey(line.productId, unit);
  const unitsPerSaleUnit = unit === "PACK" ? line.unitsPerPack : 1;
  const target = lines.find((l) => l.key === targetKey);

  const switched: CartLine = target
    ? { ...target, quantity: target.quantity + line.quantity }
    : {
        ...line,
        key: targetKey,
        unit,
        unitsPerSaleUnit,
        // Exact in whole kobo: a line's price is always the tier's unit price
        // times the base units in it, so dividing recovers that unit price.
        unitPrice: (line.unitPrice / line.unitsPerSaleUnit) * unitsPerSaleUnit,
      };

  const next = lines
    .filter((l) => l.key !== targetKey)
    .map((l) => (l.key === key ? switched : l));

  return switched.quantity <= lineCeiling(next, switched) ? next : null;
}

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "SET_PRICE_TIER":
      // Every line is repriced, not just the ones added afterwards: the server
      // charges the whole basket at one tier. Units stay as the cashier set
      // them — tier and unit are independent.
      return {
        ...state,
        priceTier: action.priceTier,
        lines: state.lines.map((line) => ({
          ...line,
          unitPrice: line.unitPrices[action.priceTier] * line.unitsPerSaleUnit,
        })),
      };

    case "ADD": {
      const { lookup } = action;
      const unit: SaleUnit =
        lookup.product.unitsPerPack > 1
          ? (action.unit ?? defaultUnitForTier(state.priceTier))
          : "SINGLE";
      const key = lineKey(lookup.product.id, unit);
      const quantity = Math.max(Math.floor(action.quantity ?? 1), 1);

      // The lookup is fresh, so every line of this product takes the new shelf
      // figure — not only the one being added to.
      const lines = state.lines.map((line) =>
        line.productId === lookup.product.id
          ? { ...line, availableBase: lookup.availableStock }
          : line,
      );

      // Scanning the same product in the same unit adds to its line rather
      // than creating a second one — a duplicate row is a receipt error
      // waiting to happen.
      const existing = lines.find((line) => line.key === key);
      const candidate = existing
        ? { ...existing, quantity: existing.quantity + quantity }
        : lineFromLookup(lookup, unit, quantity, state.priceTier);

      // Nothing left in this unit. The till checks before adding, so this only
      // guards against a stale lookup.
      const ceiling = lineCeiling(lines, candidate);
      if (ceiling < 1) return { ...state, lines };

      const added = { ...candidate, quantity: Math.min(candidate.quantity, ceiling) };
      return {
        ...state,
        lines: existing
          ? lines.map((line) => (line.key === key ? added : line))
          : // Newest at the top: the cashier watches what they just scanned.
            [added, ...lines],
        lastTouchedKey: key,
      };
    }

    case "SET_QUANTITY": {
      const line = state.lines.find((l) => l.key === action.key);
      if (!line) return state;
      if (action.quantity <= 0) {
        return cartReducer(state, { type: "REMOVE", key: action.key });
      }

      // Never past what the shelf can supply once the product's other line has
      // taken its share. Removing a line is always deliberate, so the floor
      // is one.
      const quantity = Math.max(
        Math.min(Math.floor(action.quantity), lineCeiling(state.lines, line)),
        1,
      );
      return {
        ...state,
        lines: state.lines.map((l) => (l.key === action.key ? { ...l, quantity } : l)),
        lastTouchedKey: action.key,
      };
    }

    case "ADJUST_QUANTITY": {
      const line = state.lines.find((l) => l.key === action.key);
      if (!line) return state;
      return cartReducer(state, {
        type: "SET_QUANTITY",
        key: action.key,
        quantity: line.quantity + action.delta,
      });
    }

    case "SET_UNIT": {
      const line = state.lines.find((l) => l.key === action.key);
      const lines = switchLineUnit(state.lines, action.key, action.unit);
      if (!line || !lines) return state;
      return {
        ...state,
        lines,
        lastTouchedKey: lineKey(line.productId, action.unit),
      };
    }

    case "REMOVE":
      return {
        ...state,
        lines: state.lines.filter((line) => line.key !== action.key),
        lastTouchedKey: null,
      };

    case "SET_DISCOUNT":
      return { ...state, discount: Math.max(0, action.discount) };

    case "CLEAR":
      return emptyCart;

    case "RESTORE":
      return action.state;
  }
}

/* -------------------------------------------------------------------------
   Derived figures
   ------------------------------------------------------------------------- */

export function cartSubtotal(state: CartState): Money {
  return sumMoney(
    state.lines.map((line) => lineTotal(line.unitPrice, line.quantity)),
  );
}

export function cartTotal(state: CartState): Money {
  // A discount can never make the total negative.
  return Math.max(cartSubtotal(state) - state.discount, 0);
}

export function cartItemCount(state: CartState): number {
  return state.lines.reduce((total, line) => total + line.quantity, 0);
}
