"use client";

import { useState, type KeyboardEvent } from "react";

import { cn } from "@/lib/cn";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { formatMoney, nairaToKobo, parseMoneyInput } from "@/lib/money";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS } from "@/lib/status";
import type { Money } from "@/types/common";
import type { Customer, PaymentMethod } from "@/types/domain";
import {
  isSettlementRefusal,
  settlePayment,
  type PaymentTender,
} from "../settlement";

/** Notes a Nigerian pharmacy actually gets handed. */
const QUICK_TENDER_NAIRA = [500, 1000, 2000, 5000, 10_000];

const NO_AMOUNTS: Record<PaymentMethod, string> = {
  CASH: "",
  CARD: "",
  TRANSFER: "",
};

/** Kobo as the amount field expects it: plain naira, no trailing zeros. */
const toField = (kobo: Money) => String(kobo / 100);

const FIELD_CLASS =
  "num w-full rounded-md bg-white px-3 font-semibold tabular-nums text-neutral-900 ring-1 ring-inset ring-neutral-300 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-60";

const CHIP_CLASS =
  "rounded-md bg-neutral-100 px-2.5 py-1.5 text-meta font-medium text-neutral-700 hover:bg-neutral-200 disabled:opacity-60";

/**
 * Taking payment.
 *
 * Two things a counter actually deals with are built in rather than worked
 * around:
 *
 *   · A customer paying by more than one method — part cash, part card. Split
 *     mode takes an amount per method; the rules for what that settles to live
 *     in `settlePayment`, shared in spirit with the server.
 *   · A regular who already owes money. Their balance is added to what the
 *     till asks for, so it is collected with the sale rather than forgotten —
 *     and it can be left off with one tick if they cannot pay it today.
 *
 * The caller keys this component on `open`, so every raise starts clean.
 */
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
  /** The method chosen on the order panel; split mode starts from it. */
  paymentMethod: PaymentMethod;
  /** Attached account, if this sale is on one rather than a walk-in. */
  customer: Customer | null;
  processing: boolean;
  /** A server rejection, shown without closing so the cart survives. */
  error: string | null;
  onConfirm: (payments: PaymentTender[]) => void;
}) {
  const balance = customer?.balance ?? 0;

  const [includeBalance, setIncludeBalance] = useState(balance !== 0);
  const [split, setSplit] = useState(false);
  const [amounts, setAmounts] = useState(NO_AMOUNTS);

  // What to ask the customer for: this sale, plus what they owe — or less the
  // credit they hold. It is only a figure to aim at; the settlement below is
  // worked out from what is actually handed over.
  const amountDue = Math.max(
    total + (customer && includeBalance ? balance : 0),
    0,
  );

  const methods: readonly PaymentMethod[] = split
    ? PAYMENT_METHODS
    : [paymentMethod];

  const fields = methods.map((method) => ({
    method,
    raw: amounts[method],
    kobo: parseMoneyInput(amounts[method]),
  }));
  const invalid = fields.some(
    (field) => field.raw.trim() !== "" && field.kobo === null,
  );
  const entered = fields.some((field) => field.kobo !== null);
  const tenders: PaymentTender[] = fields.map((field) => ({
    method: field.method,
    amount: field.kobo ?? 0,
  }));
  const paid = tenders.reduce((sum, tender) => sum + tender.amount, 0);
  const outstanding = amountDue - paid;

  const result = settlePayment({
    total,
    tenders,
    customerBalance: customer ? balance : null,
  });
  const refusal = isSettlementRefusal(result) ? result : null;
  const settled = isSettlementRefusal(result) ? null : result;

  // An amount has to be typed even for a sale wholly on account — ₦0 is a
  // deliberate answer, an empty field is not.
  const canConfirm = !processing && !invalid && entered && settled !== null;

  const newBalance =
    settled && customer
      ? balance + settled.debtCharged - settled.debtRepaid
      : null;

  const nonCashUsed = tenders.some(
    (tender) => tender.method !== "CASH" && tender.amount > 0,
  );

  function setAmount(method: PaymentMethod, value: string) {
    setAmounts((current) => ({ ...current, [method]: value }));
  }

  /** Puts whatever the other methods leave outstanding on this one. */
  function fillRest(method: PaymentMethod) {
    const others = tenders
      .filter((tender) => tender.method !== method)
      .reduce((sum, tender) => sum + tender.amount, 0);
    setAmount(method, toField(Math.max(amountDue - others, 0)));
  }

  function toggleSplit() {
    if (split) {
      // Back to one method: amounts typed against the others would otherwise
      // sit hidden and reappear if split is opened again.
      setAmounts((current) => ({
        ...NO_AMOUNTS,
        [paymentMethod]: current[paymentMethod],
      }));
    }
    setSplit(!split);
  }

  function confirm() {
    if (!canConfirm) return;
    const used = tenders.filter((tender) => tender.amount > 0);
    // Nothing handed over at all is a sale wholly on account, which still
    // needs a method to be filed under.
    onConfirm(used.length > 0 ? used : [{ method: paymentMethod, amount: 0 }]);
  }

  function confirmOnEnter(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      confirm();
    }
  }

  const changeLabel =
    settled && settled.debtCharged > 0 ? "To account" : "Change";
  const changeValue = !entered
    ? null
    : settled
      ? settled.debtCharged > 0
        ? settled.debtCharged
        : settled.changeGiven
      : null;

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
            onClick={confirm}
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
              {formatMoney(amountDue)}
            </span>
          </div>
          <p className="num mt-1 text-meta text-neutral-500">
            This sale {formatMoney(total)} · {itemCount}{" "}
            {itemCount === 1 ? "item" : "items"}
          </p>

          {customer && balance !== 0 && (
            <label className="mt-2 flex cursor-pointer items-start gap-2 border-t border-neutral-200 pt-2">
              <input
                type="checkbox"
                checked={includeBalance}
                disabled={processing}
                onChange={(event) => setIncludeBalance(event.target.checked)}
                className="mt-0.5 size-4 shrink-0 accent-primary-700"
              />
              <span className="text-meta text-neutral-700">
                {balance > 0 ? (
                  <>
                    Collect the{" "}
                    <span className="num font-semibold text-danger-700">
                      {formatMoney(balance)}
                    </span>{" "}
                    {customer.name} already owes
                  </>
                ) : (
                  <>
                    Use {customer.name}&apos;s{" "}
                    <span className="num font-semibold text-success-700">
                      {formatMoney(-balance)}
                    </span>{" "}
                    credit
                  </>
                )}
              </span>
            </label>
          )}
        </div>

        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-meta font-medium text-neutral-700">
              {split
                ? "Paid by"
                : `Amount paid · ${PAYMENT_METHOD_LABELS[paymentMethod]}`}
            </span>
            <button
              type="button"
              disabled={processing}
              onClick={toggleSplit}
              className="rounded-md px-2 py-1 text-meta font-medium text-primary-700 hover:bg-primary-50 disabled:opacity-60"
            >
              {split ? "Use one method" : "Split payment"}
            </button>
          </div>

          {split ? (
            <div className="flex flex-col gap-2">
              {PAYMENT_METHODS.map((method) => (
                <div key={method} className="flex items-center gap-2">
                  <label
                    htmlFor={`pay-${method}`}
                    className="w-28 shrink-0 text-meta text-neutral-600"
                  >
                    {PAYMENT_METHOD_LABELS[method]}
                  </label>
                  <input
                    id={`pay-${method}`}
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    autoFocus={method === paymentMethod}
                    disabled={processing}
                    value={amounts[method]}
                    onChange={(event) => setAmount(method, event.target.value)}
                    onKeyDown={confirmOnEnter}
                    placeholder="0.00"
                    className={cn(FIELD_CLASS, "h-control-lg min-w-0 flex-1 text-base")}
                  />
                  <button
                    type="button"
                    disabled={processing}
                    onClick={() => fillRest(method)}
                    className={cn(CHIP_CLASS, "shrink-0")}
                  >
                    Rest
                  </button>
                </div>
              ))}

              <p className="num text-meta text-neutral-500" aria-live="polite">
                Paid {formatMoney(paid)} ·{" "}
                {outstanding > 0
                  ? `${formatMoney(outstanding)} still to pay`
                  : outstanding < 0
                    ? `${formatMoney(-outstanding)} over`
                    : "exact"}
              </p>
            </div>
          ) : (
            <>
              <input
                id="amount-received"
                type="text"
                inputMode="decimal"
                aria-label="Amount paid"
                autoFocus
                autoComplete="off"
                disabled={processing}
                value={amounts[paymentMethod]}
                onChange={(event) =>
                  setAmount(paymentMethod, event.target.value)
                }
                onKeyDown={confirmOnEnter}
                placeholder="0.00"
                aria-describedby="change-due"
                className={cn(FIELD_CLASS, "h-control-xl text-total")}
              />

              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  disabled={processing}
                  onClick={() => setAmount(paymentMethod, toField(amountDue))}
                  className={CHIP_CLASS}
                >
                  Exact
                </button>
                {(paymentMethod === "CASH" ? QUICK_TENDER_NAIRA : [])
                  .filter((naira) => nairaToKobo(naira) >= amountDue)
                  .slice(0, 4)
                  .map((naira) => (
                    <button
                      key={naira}
                      type="button"
                      disabled={processing}
                      onClick={() => setAmount(paymentMethod, String(naira))}
                      className={cn(CHIP_CLASS, "num")}
                    >
                      {formatMoney(nairaToKobo(naira)).replace(".00", "")}
                    </button>
                  ))}
              </div>
            </>
          )}

          {entered && refusal && (
            <p
              role="alert"
              className="rounded-md bg-warning-50 px-3 py-2 text-meta text-warning-800 ring-1 ring-inset ring-warning-200"
            >
              {refusal.message}
            </p>
          )}

          {customer && settled && (settled.debtCharged > 0 || settled.debtRepaid > 0) && (
            <div className="flex items-center justify-between gap-2 rounded-md bg-neutral-50 px-3 py-2 ring-1 ring-inset ring-neutral-200">
              <span
                className={cn(
                  "text-meta",
                  settled.debtCharged > 0
                    ? "text-warning-800"
                    : "text-success-700",
                )}
              >
                {settled.debtCharged > 0
                  ? `${formatMoney(settled.debtCharged)} added to ${customer.name}'s account`
                  : `${formatMoney(settled.debtRepaid)} taken off ${customer.name}'s account`}
              </span>
              <span className="num shrink-0 text-meta font-semibold text-neutral-700">
                New balance {formatMoney(newBalance ?? 0)}
              </span>
            </div>
          )}

          <div
            id="change-due"
            aria-live="polite"
            className={cn(
              "flex items-baseline justify-between gap-3 rounded-md px-3 py-2.5 ring-1 ring-inset",
              changeValue === null
                ? "bg-neutral-50 ring-neutral-200"
                : changeLabel === "To account"
                  ? "bg-warning-50 ring-warning-200"
                  : "bg-success-50 ring-success-200",
            )}
          >
            <span className="text-meta font-medium text-neutral-600">
              {changeLabel}
            </span>
            <span
              className={cn(
                "num text-title font-bold tabular-nums",
                changeValue === null
                  ? "text-neutral-400"
                  : changeLabel === "To account"
                    ? "text-warning-800"
                    : "text-success-700",
              )}
            >
              {changeValue === null ? "—" : formatMoney(changeValue)}
            </span>
          </div>

          {nonCashUsed && (
            <p className="text-meta text-neutral-500">
              Confirm the card or transfer payment has cleared before completing
              this sale.
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
