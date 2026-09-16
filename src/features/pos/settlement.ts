import type { Money } from "@/types/common";
import type { PaymentMethod } from "@/types/domain";

/** Money handed over by one method. */
export interface PaymentTender {
  method: PaymentMethod;
  amount: Money;
}

export type AmountsByMethod = Record<PaymentMethod, Money>;

export interface Settlement {
  /** Handed over, by method. */
  tendered: AmountsByMethod;
  /** Of that, what paid for this sale's goods, by method. */
  applied: AmountsByMethod;
  received: Money;
  /** A shortfall put on the customer's account. */
  debtCharged: Money;
  /** A surplus that cleared some of what they already owed. */
  debtRepaid: Money;
  /** Given back from the cash. Null when no cash changed hands. */
  changeGiven: Money | null;
}

export interface SettlementRefusal {
  code: "INSUFFICIENT_PAYMENT" | "NON_CASH_OVERPAYMENT";
  message: string;
}

/**
 * Card and transfer are counted against the total first, cash last — so
 * anything paid over the total is left in the cash, the only place change can
 * physically come from.
 */
const APPLY_ORDER: readonly PaymentMethod[] = ["CARD", "TRANSFER", "CASH"];

const noAmounts = (): AmountsByMethod => ({ CASH: 0, CARD: 0, TRANSFER: 0 });

/**
 * How a payment settles: change, debt added, debt cleared — or why it cannot.
 *
 * The till's copy of the API's rules (services/sales/settlement.ts), so the
 * cashier sees the outcome before pressing confirm. The server settles the
 * sale again, and its answer is the one that counts; this only has to agree
 * with it.
 *
 *   short — the rest goes on a named account. A walk-in cannot run up debt,
 *           because there would be nobody to bill.
 *   over  — the surplus clears existing debt first; only what is left after
 *           that is change, and change can only come out of cash.
 */
export function settlePayment({
  total,
  tenders,
  customerBalance,
}: {
  total: Money;
  tenders: PaymentTender[];
  /** The account's balance, or null for a walk-in. */
  customerBalance: Money | null;
}): Settlement | SettlementRefusal {
  const tendered = noAmounts();
  for (const tender of tenders) {
    tendered[tender.method] += Math.max(Math.floor(tender.amount), 0);
  }

  const applied = noAmounts();
  let remaining = total;
  for (const method of APPLY_ORDER) {
    const part = Math.min(tendered[method], remaining);
    applied[method] = part;
    remaining -= part;
  }

  const received = tendered.CASH + tendered.CARD + tendered.TRANSFER;
  const cashHandled = tendered.CASH > 0;

  if (remaining > 0) {
    if (customerBalance === null) {
      return {
        code: "INSUFFICIENT_PAYMENT",
        message:
          "That is less than the total. Attach a customer account to put the rest on credit.",
      };
    }

    return {
      tendered,
      applied,
      received,
      debtCharged: remaining,
      debtRepaid: 0,
      changeGiven: cashHandled ? 0 : null,
    };
  }

  const surplus = received - total;
  const debtRepaid =
    customerBalance === null
      ? 0
      : Math.min(surplus, Math.max(customerBalance, 0));
  const leftOver = surplus - debtRepaid;
  const cashOver = tendered.CASH - applied.CASH;

  if (leftOver > cashOver) {
    return {
      code: "NON_CASH_OVERPAYMENT",
      message:
        "Card and transfer cannot be more than what is due — only cash can be given back as change.",
    };
  }

  return {
    tendered,
    applied,
    received,
    debtCharged: 0,
    debtRepaid,
    changeGiven: cashHandled ? leftOver : null,
  };
}

export function isSettlementRefusal(
  result: Settlement | SettlementRefusal,
): result is SettlementRefusal {
  return "code" in result;
}
