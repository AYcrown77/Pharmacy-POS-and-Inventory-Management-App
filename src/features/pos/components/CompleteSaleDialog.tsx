"use client";

import { useRef, useState } from "react";

import { cn } from "@/lib/cn";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { formatMoney, nairaToKobo, parseMoneyInput } from "@/lib/money";
import { PAYMENT_METHOD_LABELS } from "@/lib/status";
import type { Money } from "@/types/common";
import type { PaymentMethod, Customer } from "@/types/domain";

/** Notes a Nigerian pharmacy actually gets handed. */
const QUICK_TENDER_NAIRA = [500, 1000, 2000, 5000, 10_000];

export function CompleteSaleDialog({
  open,
  onOpenChange,
  total,
  itemCount,
  paymentMethod,
  customer,
  processing,
  error,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  total: Money;
  itemCount: number;
  paymentMethod: PaymentMethod;
  /** Attached account, if this sale is on credit rather than a walk-in. */
  customer: Customer | null;
  processing: boolean;
  /** A server rejection, shown without closing so the cart survives. */
  error: string | null;
  onConfirm: (amountReceived: Money | null) => void;
}) {
  const [received, setReceived] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const isCash = paymentMethod === "CASH";
  const receivedKobo = parseMoneyInput(received);
  const change =
    receivedKobo !== null && receivedKobo >= total ? receivedKobo - total : null;
  const shortfall =
    receivedKobo !== null && receivedKobo < total ? total - receivedKobo : null;

  // Cash needs an amount before the sale can be confirmed; the other methods
  // are settled on the bank's terminal before the cashier gets here.
  // A shortfall is only payable if there is an account to bill it to. A
  // walk-in who cannot pay in full has to put something back.
  // Every method asks what was actually paid, card and transfer included: a
  // transfer can come up short just as a handful of notes can, and the till
  // cannot put the difference on an account it was never told about.
  const canConfirm = processing
    ? false
    : receivedKobo !== null && (receivedKobo >= total || customer !== null);

  /** What this payment will do to the customer's balance. */
  const debtEffect = (() => {
    if (!customer || receivedKobo === null) return null;

    if (shortfall !== null) {
      return {
        tone: "charge" as const,
        text: `${formatMoney(shortfall)} added to ${customer.name}'s account`,
        balanceAfter: customer.balance + shortfall,
      };
    }

    // A surplus clears what they owe before any change is handed back.
    const surplus = receivedKobo - total;
    const repaid = Math.min(surplus, Math.max(customer.balance, 0));
    if (repaid <= 0) return null;

    return {
      tone: "repay" as const,
      text: `${formatMoney(repaid)} taken off ${customer.name}'s account`,
      balanceAfter: customer.balance - repaid,
    };
  })();

  // Note: the caller keys this component on `open`, so a fresh instance
  // mounts each time the dialog is raised and `received` starts empty. That
  // resets the field without an effect, and covers every close path —
  // including a programmatic one after the sale succeeds.

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Complete sale"
      size="sm"
      dismissible={!processing}
      hideCloseButton={processing}
      footer={
        <>
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={processing}
          >
            Back to cart
          </Button>
          <Button
            variant="primary"
            loading={processing}
            disabled={!canConfirm}
            onClick={() => onConfirm(receivedKobo)}
          >
            Confirm sale
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && (
          <Alert tone="danger" title="The sale was not completed">
            {error}
          </Alert>
        )}

        <div className="rounded-md bg-neutral-50 px-4 py-3 ring-1 ring-inset ring-neutral-200">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-micro font-semibold uppercase tracking-wide text-neutral-500">
              Amount due
            </span>
            <span className="num text-total font-bold tabular-nums text-neutral-900">
              {formatMoney(total)}
            </span>
          </div>
          <p className="mt-1 text-meta text-neutral-500">
            {itemCount} {itemCount === 1 ? "item" : "items"} ·{" "}
            {PAYMENT_METHOD_LABELS[paymentMethod]}
          </p>
        </div>

        <div className="flex flex-col gap-2.5">
            <label
              htmlFor="amount-received"
              className="text-meta font-medium text-neutral-700"
            >
              {isCash ? "Amount received" : "Amount paid"}
            </label>

            <input
              id="amount-received"
              ref={inputRef}
              type="text"
              inputMode="decimal"
              autoFocus
              autoComplete="off"
              disabled={processing}
              value={received}
              onChange={(event) => setReceived(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && canConfirm) {
                  event.preventDefault();
                  onConfirm(receivedKobo);
                }
              }}
              placeholder="0.00"
              aria-describedby="change-due"
              className="num h-control-xl w-full rounded-md bg-white px-3 text-total font-semibold tabular-nums text-neutral-900 ring-1 ring-inset ring-neutral-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />

            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                disabled={processing}
                onClick={() => setReceived(String(total / 100))}
                className="rounded-md bg-neutral-100 px-2.5 py-1.5 text-meta font-medium text-neutral-700 hover:bg-neutral-200"
              >
                Exact
              </button>
              {(isCash ? QUICK_TENDER_NAIRA : [])
                .filter((naira) => nairaToKobo(naira) >= total)
                .slice(0, 4)
                .map((naira) => (
                  <button
                    key={naira}
                    type="button"
                    disabled={processing}
                    onClick={() => setReceived(String(naira))}
                    className="num rounded-md bg-neutral-100 px-2.5 py-1.5 text-meta font-medium text-neutral-700 hover:bg-neutral-200"
                  >
                    {formatMoney(nairaToKobo(naira)).replace(".00", "")}
                  </button>
                ))}
            </div>

            {customer && (
              <div className="flex flex-col gap-1 rounded-md bg-neutral-50 px-3 py-2 ring-1 ring-inset ring-neutral-200">
                <div className="flex items-center justify-between">
                  <span className="text-meta font-medium text-neutral-600">
                    {customer.name}
                  </span>
                  <span
                    className={cn(
                      "num text-meta font-semibold",
                      customer.balance > 0
                        ? "text-danger-700"
                        : "text-neutral-500",
                    )}
                  >
                    {customer.balance > 0
                      ? `Owes ${formatMoney(customer.balance)}`
                      : "Settled"}
                  </span>
                </div>

                {debtEffect && (
                  <div className="flex items-center justify-between gap-2 border-t border-neutral-200 pt-1">
                    <span
                      className={cn(
                        "text-meta",
                        debtEffect.tone === "charge"
                          ? "text-warning-800"
                          : "text-success-700",
                      )}
                    >
                      {debtEffect.text}
                    </span>
                    <span className="num shrink-0 text-meta font-semibold text-neutral-700">
                      New balance {formatMoney(debtEffect.balanceAfter)}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div
              id="change-due"
              aria-live="polite"
              className={cn(
                "flex items-baseline justify-between gap-3 rounded-md px-3 py-2.5 ring-1 ring-inset",
                change !== null
                  ? "bg-success-50 ring-success-200"
                  : shortfall !== null
                    ? "bg-warning-50 ring-warning-200"
                    : "bg-neutral-50 ring-neutral-200",
              )}
            >
              <span className="text-meta font-medium text-neutral-600">
                {shortfall !== null
                  ? customer
                    ? "To account"
                    : "Still owing"
                  : "Change"}
              </span>
              <span
                className={cn(
                  "num text-title font-bold tabular-nums",
                  change !== null
                    ? "text-success-700"
                    : shortfall !== null
                      ? "text-warning-800"
                      : "text-neutral-400",
                )}
              >
                {change !== null
                  ? formatMoney(change)
                  : shortfall !== null
                    ? formatMoney(shortfall)
                    : "—"}
              </span>
            </div>

            {!isCash && (
              <p className="text-meta text-neutral-500">
                Confirm the payment cleared on the{" "}
                {paymentMethod === "CARD" ? "card terminal" : "bank transfer"}{" "}
                before completing this sale.
              </p>
            )}
          </div>
      </div>
    </Modal>
  );
}
