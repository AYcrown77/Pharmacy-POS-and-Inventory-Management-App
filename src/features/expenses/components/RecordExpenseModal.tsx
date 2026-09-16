"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input, NativeSelect, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { today } from "@/lib/date";
import { formatMoney, parseMoneyInput } from "@/lib/money";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
} from "@/lib/status";
import type { ExpenseInput } from "@/services/expenses.service";
import type { ExpenseCategory, PaymentMethod } from "@/types/domain";

/**
 * Records money paid out.
 *
 * The reason is required and worded as a question, because it is the only
 * thing that will explain the amount to whoever reads the report next week.
 * The caller keys this on `open`, so each raise starts clean.
 */
export function RecordExpenseModal({
  open,
  onOpenChange,
  isSubmitting,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSubmitting: boolean;
  onSubmit: (input: ExpenseInput) => void;
}) {
  const latest = today();
  const [expenseDate, setExpenseDate] = useState(latest);
  const [category, setCategory] = useState<ExpenseCategory>("GENERATOR_FUEL");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [reason, setReason] = useState("");

  const kobo = parseMoneyInput(amount);
  const dateIsValid = /^\d{4}-\d{2}-\d{2}$/.test(expenseDate);
  const dateIsFuture = dateIsValid && expenseDate > latest;
  const canSubmit =
    !isSubmitting &&
    kobo !== null &&
    kobo > 0 &&
    dateIsValid &&
    !dateIsFuture &&
    reason.trim().length >= 3;

  function submit() {
    if (!canSubmit || kobo === null) return;
    onSubmit({
      expenseDate,
      category,
      amount: kobo,
      paymentMethod,
      reason: reason.trim(),
    });
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Record an expense"
      description="Money paid out of the business. It comes off that day's takings in the sales report."
      size="sm"
      dismissible={!isSubmitting}
      footer={
        <>
          <Button
            variant="secondary"
            disabled={isSubmitting}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={isSubmitting}
            disabled={!canSubmit}
            onClick={submit}
          >
            Record expense
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Amount" required hint="In naira.">
            {(ids) => (
              <Input
                {...ids}
                value={amount}
                autoFocus
                inputMode="decimal"
                autoComplete="off"
                placeholder="0.00"
                className="num"
                onChange={(event) => setAmount(event.target.value)}
              />
            )}
          </FormField>

          <FormField
            label="Date"
            required
            error={dateIsFuture ? "Cannot be in the future" : undefined}
          >
            {(ids) => (
              <Input
                {...ids}
                type="date"
                value={expenseDate}
                max={latest}
                onChange={(event) => setExpenseDate(event.target.value)}
              />
            )}
          </FormField>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Spent on" required>
            {(ids) => (
              <NativeSelect
                {...ids}
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value as ExpenseCategory)
                }
              >
                {EXPENSE_CATEGORIES.map((value) => (
                  <option key={value} value={value}>
                    {EXPENSE_CATEGORY_LABELS[value]}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FormField>

          <FormField label="Paid with" required>
            {(ids) => (
              <NativeSelect
                {...ids}
                value={paymentMethod}
                onChange={(event) =>
                  setPaymentMethod(event.target.value as PaymentMethod)
                }
              >
                {PAYMENT_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {PAYMENT_METHOD_LABELS[method]}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FormField>
        </div>

        <FormField
          label="What was it for?"
          required
          hint="Be specific — this is what explains the money later."
        >
          {(ids) => (
            <Textarea
              {...ids}
              rows={3}
              maxLength={300}
              value={reason}
              placeholder="e.g. 20 litres of diesel for the generator"
              onChange={(event) => setReason(event.target.value)}
            />
          )}
        </FormField>

        {kobo !== null && kobo > 0 && paymentMethod === "CASH" && (
          <p className="text-meta text-neutral-500">
            Take{" "}
            <span className="num font-semibold text-neutral-700">
              {formatMoney(kobo)}
            </span>{" "}
            out of the cash drawer so the day-end count still balances.
          </p>
        )}
      </div>
    </Modal>
  );
}
