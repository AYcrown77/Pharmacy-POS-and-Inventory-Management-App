import { lineTotal, sumMoney } from "@/lib/money";
import type { DateOnly, Money } from "@/types/common";
import type { PriceTier } from "@/types/domain";
import type { SaleLookup } from "@/services/products.service";

/**
 * The cart.
 *
 * All the rules live in this reducer rather than scattered across handlers,
 * because the awkward cases — scanning the same product twice, hitting the
 * stock ceiling, a sale that fails at the server — are exactly where a till
 * loses a cashier's trust.
 */

export interface CartLine {
  productId: string;
  productName: string;
  /** Shown under the name so the cashier can confirm the right pack. */
  description: string | null;
  /**
   * What this line is charged at, for the tier the cart is currently on.
   * Derived from `prices` — never set independently, or the total on screen
   * could disagree with what the server charges.
   */
  unitPrice: Money;
  /** All three tier prices, so switching tier reprices without a refetch. */
  prices: Record<PriceTier, Money>;
  quantity: number;
  /** Snapshot at the time of adding; the server re-checks at payment. */
  availableStock: number;
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
  lastTouchedProductId: string | null;
}

export const emptyCart: CartState = {
  lines: [],
  discount: 0,
  priceTier: "CONSUMER",
  lastTouchedProductId: null,
};

export type CartAction =
  | { type: "ADD"; lookup: SaleLookup; quantity?: number }
  | { type: "SET_QUANTITY"; productId: string; quantity: number }
  | { type: "ADJUST_QUANTITY"; productId: string; delta: number }
  | { type: "REMOVE"; productId: string }
  | { type: "SET_DISCOUNT"; discount: Money }
  | { type: "SET_PRICE_TIER"; priceTier: PriceTier }
  | { type: "CLEAR" }
  | { type: "RESTORE"; state: CartState };

function lineFromLookup(
  lookup: SaleLookup,
  quantity: number,
  priceTier: PriceTier,
): CartLine {
  const nextBatch = lookup.sellableBatches[0] ?? null;

  const prices: Record<PriceTier, Money> = {
    WHOLESALE: lookup.product.priceWholesale,
    RETAIL: lookup.product.priceRetail,
    CONSUMER: lookup.product.priceConsumer,
  };

  return {
    productId: lookup.product.id,
    productName: lookup.product.name,
    description:
      [lookup.product.strength, lookup.product.brandName]
        .filter(Boolean)
        .join(" · ") || null,
    unitPrice: prices[priceTier],
    prices,
    quantity,
    availableStock: lookup.availableStock,
    expectedBatchNumber: nextBatch?.batchNumber ?? null,
    expectedExpiry: nextBatch?.expiryDate ?? null,
  };
}

/** Never let a line exceed what the snapshot says is on the shelf. */
function clampToStock(line: CartLine, quantity: number): CartLine {
  return {
    ...line,
    quantity: Math.max(1, Math.min(quantity, line.availableStock)),
  };
}

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "SET_PRICE_TIER": {
      // Repricing every line, not just the ones added afterwards: the server
      // charges the whole basket at one tier, so anything else would show the
      // cashier a total the customer is not asked to pay.
      return {
        ...state,
        priceTier: action.priceTier,
        lines: state.lines.map((line) => ({
          ...line,
          unitPrice: line.prices[action.priceTier],
        })),
      };
    }

    case "ADD": {
      const { lookup } = action;
      const quantity = action.quantity ?? 1;
      const existing = state.lines.find(
        (line) => line.productId === lookup.product.id,
      );

      // Scanning the same product twice increments the line rather than
      // creating a second one — a duplicate row is a receipt error waiting
      // to happen, and the cashier is not told which is which.
      if (existing) {
        return {
          ...state,
          lines: state.lines.map((line) =>
            line.productId === lookup.product.id
              ? clampToStock(
                  // Refresh the stock snapshot on every scan.
                  { ...line, availableStock: lookup.availableStock },
                  line.quantity + quantity,
                )
              : line,
          ),
          lastTouchedProductId: lookup.product.id,
        };
      }

      return {
        ...state,
        // Newest at the top: the cashier watches what they just scanned.
        lines: [
          lineFromLookup(lookup, quantity, state.priceTier),
          ...state.lines,
        ],
        lastTouchedProductId: lookup.product.id,
      };
    }

    case "SET_QUANTITY": {
      if (action.quantity <= 0) {
        return cartReducer(state, {
          type: "REMOVE",
          productId: action.productId,
        });
      }
      return {
        ...state,
        lines: state.lines.map((line) =>
          line.productId === action.productId
            ? clampToStock(line, action.quantity)
            : line,
        ),
        lastTouchedProductId: action.productId,
      };
    }

    case "ADJUST_QUANTITY": {
      const line = state.lines.find((l) => l.productId === action.productId);
      if (!line) return state;
      return cartReducer(state, {
        type: "SET_QUANTITY",
        productId: action.productId,
        quantity: line.quantity + action.delta,
      });
    }

    case "REMOVE":
      return {
        ...state,
        lines: state.lines.filter((line) => line.productId !== action.productId),
        lastTouchedProductId: null,
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

/** True when a line is already holding every unit on the shelf. */
export function isLineAtStockCeiling(line: CartLine): boolean {
  return line.quantity >= line.availableStock;
}
