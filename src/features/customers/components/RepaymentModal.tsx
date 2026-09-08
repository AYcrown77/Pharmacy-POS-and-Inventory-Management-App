"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { formatMoney, parseMoneyInput } from "@/lib/money";
import type { Customer } from "@/types/domain";

/**
 * Money handed over against what a customer owes.
 *
 * Paying more than the balance is allowed but never by accident: it leaves the
 * pharmacy holding credit it has to honour later, so it takes a deliberate
 * second confirmation.
 */
export function RepaymentModal({
  customer,
  open,
  onOpenChange,
  isSubmitting,
  onSubmit,
}: {
  customer: Customer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSubmitting: boolean;
  onSubmit: (amount: number, allowOverpayment?: boolean) => Promise<unknown>;
}) {
  const [amount, setAmount] = useState("");
  const kobo = parseMoneyInput(amount);

  const owed = customer?.balance ?? 0;
  const isOverpayment = kobo !== null && kobo > owed;
  const remaining = kobo !== null ? owed - kobo : owed;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={`Take payment from ${customer?.name ?? ""}`}
      description={`Currently owing ${formatMoney(owed)}.`}
      size="sm"
      dismissible={!isSubmitting}
      footer={
        <>
          <Button variant="secondary" disabled={isSubmitting} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={isSubmitting}
            disabled={kobo === null || kobo <= 0}
            onClick={() => void onSubmit(kobo!, isOverpayment)}
          >
            {isOverpayment ? "Record as credit" : "Record payment"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <FormField label="Amount received" required hint="In naira.">
          {(ids) => (
            <Input
              {...ids}
              value={amount}
              autoFocus
              inputMode="decimal"
              placeholder="0.00"
              className="num"
              onChange={(event) => setAmount(event.target.value)}
            />
          )}
        </FormField>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => setAmount(String(owed / 100))}>
            Pay off {formatMoney(owed)}
          </Button>
        </div>

        {kobo !== null && kobo > 0 && (
          <p className="text-meta text-neutral-600">
            {isOverpayment ? (
              <>
                That is {formatMoney(kobo - owed)} more than is owed.{" "}
                <span className="font-medium text-warning-800">
                  The difference stays on the account as credit.
                </span>
              </>
            ) : (
              <>
                Balance after this payment:{" "}
                <span className="num font-semibold text-neutral-900">
                  {formatMoney(remaining)}
                </span>
              </>
            )}
          </p>
        )}
      </div>
    </Modal>
  );
}
