"use client";

import { useCallback, useEffect, useMemo, useReducer } from "react";

import {
  cartItemCount,
  cartReducer,
  cartSubtotal,
  cartTotal,
  emptyCart,
  type CartAction,
  type CartState,
} from "./cart";

/**
 * Cart state, mirrored to `sessionStorage`.
 *
 * The specification requires automatic session expiry, and a POS terminal
 * gets reloaded for all sorts of reasons. Losing a half-built basket at the
 * counter — with a customer waiting — is the worst failure this screen has,
 * so the draft survives a reload.
 *
 * `sessionStorage`, not `localStorage`: the draft belongs to this browser
 * session at this till, and should not outlive it.
 */

// Versioned with the shape of a cart line. A draft from before units were
// chosen per line would restore lines with no unit and no per-unit prices, so
// a new key simply leaves it behind.
const DRAFT_KEY = "mhp.pos.draft.v2";

function loadDraft(): CartState {
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return emptyCart;

    const parsed = JSON.parse(raw) as Partial<CartState>;
    // Tolerate a draft written by another build rather than crashing the till.
    const usable =
      Array.isArray(parsed.lines) &&
      parsed.lines.every((line) => typeof line?.key === "string" && line.unitPrices);
    if (!usable) return emptyCart;

    return { ...emptyCart, ...parsed, lastTouchedKey: null };
  } catch {
    return emptyCart;
  }
}

function saveDraft(state: CartState) {
  try {
    if (state.lines.length === 0) {
      window.sessionStorage.removeItem(DRAFT_KEY);
    } else {
      window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(state));
    }
  } catch {
    // Storage unavailable (private mode, blocked site data). The cart still
    // works; it just will not survive a reload.
  }
}

export function usePosCart() {
  // Lazy initialiser reads storage during the first render. Safe because the
  // POS terminal is mounted client-only, so there is no server pass to
  // mismatch against.
  const [state, dispatch] = useReducer(cartReducer, undefined, loadDraft);

  useEffect(() => {
    saveDraft(state);
  }, [state]);

  const subtotal = cartSubtotal(state);
  const total = cartTotal(state);
  const itemCount = cartItemCount(state);

  const run = useCallback((action: CartAction) => dispatch(action), []);

  return useMemo(
    () => ({
      state,
      dispatch: run,
      subtotal,
      total,
      itemCount,
      isEmpty: state.lines.length === 0,
    }),
    [state, run, subtotal, total, itemCount],
  );
}
