"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { formatDate } from "@/lib/date";
import { formatMoney } from "@/lib/money";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/status";
import type { Expense } from "@/types/domain";

/**
 * Withdraws an expense recorded in error.
 *
 * Voiding changes the takings for a day that may already have been counted,
 * so it asks why — and says plainly that the entry stays on the record.
 */
export function VoidExpenseModal({
  expense,
  open,
  onOpenChange,
  isSubmitting,
  onSubmit,
}: {
  expense: Expense | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSubmitting: boolean;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const canSubmit = !isSubmitting && reason.trim().length >= 3;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Void this expense?"
      description={
        expense
          ? `${formatMoney(expense.amount)} · ${EXPENSE_CATEGORY_LABELS[expense.category]} · ${formatDate(expense.expenseDate)}`
          : undefined
      }
      size="sm"
      dismissible={!isSubmitting}
      footer={
        <>
          <Button
            variant="secondary"
            disabled={isSubmitting}
            onClick={() => onOpenChange(false)}
          >
            Keep it
          </Button>
          <Button
            variant="danger"
            loading={isSubmitting}
            disabled={!canSubmit}
            onClick={() => canSubmit && onSubmit(reason.trim())}
          >
            Void expense
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {expense && (
          <p className="text-base text-neutral-700">
            &ldquo;{expense.reason}&rdquo;{" "}
            <span className="text-meta text-neutral-500">
              — recorded by {expense.recordedByName}
            </span>
          </p>
        )}
        <p className="text-meta text-neutral-500">
          It stays on the record, marked as voided, and stops counting against
          takings. Use this only for an entry made in error.
        </p>
        <FormField label="Why is it being voided?" required>
          {(ids) => (
            <Textarea
              {...ids}
              rows={2}
              autoFocus
              maxLength={300}
              value={reason}
              placeholder="e.g. Entered twice"
              onChange={(event) => setReason(event.target.value)}
            />
          )}
        </FormField>
      </div>
    </Modal>
  );
}
