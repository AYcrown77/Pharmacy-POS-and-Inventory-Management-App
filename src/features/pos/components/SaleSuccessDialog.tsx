"use client";

import { useRouter } from "next/navigation";
import { CheckCircle2, Eye, Printer, ScanBarcode } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { formatMoney } from "@/lib/money";
import { PAYMENT_METHOD_LABELS } from "@/lib/status";
import type { Sale } from "@/types/domain";

/**
 * Deliberately plain. The cashier has a queue: this screen confirms the sale,
 * offers the receipt, and gets out of the way. No animation, no confetti.
 */
export function SaleSuccessDialog({
  sale,
  onNewSale,
  onPrint,
}: {
  sale: Sale | null;
  onNewSale: () => void;
  onPrint: () => void;
}) {
  const router = useRouter();

  return (
    <Modal
      open={Boolean(sale)}
      onOpenChange={(open) => {
        if (!open) onNewSale();
      }}
      title="Sale completed"
      size="sm"
      footer={
        <>
          <Button
            variant="secondary"
            onClick={() => sale && router.push(`/sales/${sale.id}`)}
            leadingIcon={<Eye className="size-4" />}
          >
            View sale
          </Button>
          <Button
            variant="secondary"
            onClick={onPrint}
            leadingIcon={<Printer className="size-4" />}
          >
            Print receipt
          </Button>
          <Button
            variant="primary"
            onClick={onNewSale}
            leadingIcon={<ScanBarcode className="size-4" />}
          >
            New sale
          </Button>
        </>
      }
    >
      {sale && (
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <span
            className="flex size-11 items-center justify-center rounded-full bg-success-50 text-success-600"
            aria-hidden
          >
            <CheckCircle2 className="size-6" />
          </span>

          <div>
            <p className="num text-title font-semibold text-neutral-900">
              {sale.receiptNumber}
            </p>
            <p className="text-meta text-neutral-500">
              {PAYMENT_METHOD_LABELS[sale.paymentMethod]} ·{" "}
              {sale.items.length}{" "}
              {sale.items.length === 1 ? "line" : "lines"}
            </p>
          </div>

          <div className="w-full rounded-md bg-neutral-50 px-4 py-3 ring-1 ring-inset ring-neutral-200">
            <Row label="Total" value={formatMoney(sale.total)} emphasis />
            {sale.amountReceived !== null && (
              <>
                <Row
                  label="Received"
                  value={formatMoney(sale.amountReceived)}
                />
                <Row
                  label="Change"
                  value={formatMoney(sale.changeGiven ?? 0)}
                  tone="success"
                />
              </>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

function Row({
  label,
  value,
  emphasis,
  tone,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  tone?: "success";
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5">
      <span className="text-meta text-neutral-500">{label}</span>
      <span
        className={`num tabular-nums ${
          emphasis ? "text-title font-bold" : "text-base font-medium"
        } ${tone === "success" ? "text-success-700" : "text-neutral-900"}`}
      >
        {value}
      </span>
    </div>
  );
}
