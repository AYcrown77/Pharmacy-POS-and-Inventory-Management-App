"use client";

import { Banknote, CreditCard, Landmark, Trash2 } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { KeyHint } from "@/components/ui/Tooltip";
import { formatMoney, formatQuantity } from "@/lib/money";
import { PAYMENT_METHOD_LABELS } from "@/lib/status";
import type { Money } from "@/types/common";
import type { PaymentMethod } from "@/types/domain";

const PAYMENT_OPTIONS: Array<{
  method: PaymentMethod;
  icon: ReactNode;
  hint: string;
}> = [
  { method: "CASH", icon: <Banknote className="size-4" />, hint: "F4" },
  { method: "CARD", icon: <CreditCard className="size-4" />, hint: "F6" },
  { method: "TRANSFER", icon: <Landmark className="size-4" />, hint: "F8" },
];

/**
 * The right-hand rail: what is owed, how it will be paid, and the one button
 * that matters. Fixed width so the totals never shift as items are scanned.
 */
export function OrderPanel({
  itemCount,
  subtotal,
  discount,
  total,
  paymentMethod,
  onPaymentMethodChange,
  onClear,
  onComplete,
  canComplete,
  processing,
}: {
  itemCount: number;
  subtotal: Money;
  discount: Money;
  total: Money;
  paymentMethod: PaymentMethod;
  onPaymentMethodChange: (method: PaymentMethod) => void;
  onClear: () => void;
  onComplete: () => void;
  canComplete: boolean;
  processing: boolean;
}) {
  return (
    <aside
      aria-label="Order summary"
      className="flex w-pos-panel shrink-0 flex-col border-l border-neutral-200 bg-white"
    >
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
        <h2 className="text-section font-semibold text-neutral-900">Order</h2>
        {itemCount > 0 && (
          <button
            type="button"
            onClick={onClear}
            disabled={processing}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-meta text-neutral-500 hover:bg-danger-50 hover:text-danger-700 disabled:opacity-50"
          >
            <Trash2 className="size-3.5" aria-hidden />
            Clear
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2.5 px-4 py-3">
        <SummaryLine
          label="Items"
          value={formatQuantity(itemCount)}
          muted
        />
        <SummaryLine label="Subtotal" value={formatMoney(subtotal)} muted />
        {discount > 0 && (
          <SummaryLine
            label="Discount"
            value={`− ${formatMoney(discount)}`}
            muted
          />
        )}
      </div>

      <div className="border-y border-neutral-200 bg-neutral-50 px-4 py-3">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-micro font-semibold uppercase tracking-wide text-neutral-500">
            Total
          </span>
          <span className="num text-total font-bold tabular-nums text-neutral-900">
            {formatMoney(total)}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2 px-4 py-3">
        <p className="text-micro font-semibold uppercase tracking-wide text-neutral-400">
          Payment method
        </p>

        <div
          role="radiogroup"
          aria-label="Payment method"
          className="flex flex-col gap-1.5"
        >
          {PAYMENT_OPTIONS.map((option) => {
            const selected = paymentMethod === option.method;
            return (
              <button
                key={option.method}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={processing}
                onClick={() => onPaymentMethodChange(option.method)}
                className={cn(
                  "flex h-control-lg items-center gap-2.5 rounded-md px-3 text-base font-medium transition-colors",
                  "ring-1 ring-inset disabled:opacity-60",
                  selected
                    ? "bg-primary-50 text-primary-800 ring-primary-400"
                    : "bg-white text-neutral-700 ring-neutral-300 hover:bg-neutral-50",
                )}
              >
                <span
                  className={cn(
                    "shrink-0",
                    selected ? "text-primary-700" : "text-neutral-400",
                  )}
                  aria-hidden
                >
                  {option.icon}
                </span>
                <span className="flex-1 text-left">
                  {PAYMENT_METHOD_LABELS[option.method]}
                </span>
                <KeyHint>{option.hint}</KeyHint>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-auto border-t border-neutral-200 p-4">
        <Button
          variant="primary"
          size="xl"
          fullWidth
          loading={processing}
          disabled={!canComplete}
          onClick={onComplete}
          className="justify-between"
        >
          <span>Complete sale</span>
          {!processing && (
            <span className="num rounded-sm bg-white/15 px-1.5 py-0.5 text-micro font-semibold">
              F9
            </span>
          )}
        </Button>
      </div>
    </aside>
  );
}

function SummaryLine({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-base text-neutral-500">{label}</span>
      <span
        className={cn(
          "num text-base tabular-nums",
          muted ? "text-neutral-700" : "font-semibold text-neutral-900",
        )}
      >
        {value}
      </span>
    </div>
  );
}
