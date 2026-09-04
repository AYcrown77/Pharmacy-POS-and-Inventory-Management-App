"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Receipt, RotateCcw, Search, X } from "lucide-react";
import { useMemo, useState } from "react";

import { SaleStatusBadge } from "@/components/shared/StatusBadges";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { Input, NativeSelect, Textarea } from "@/components/ui/Input";
import { ConfirmDialog } from "@/components/ui/Modal";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { toErrorMessage } from "@/lib/api/http";
import { useAuth } from "@/lib/auth/AuthProvider";
import { formatDateTime } from "@/lib/date";
import { formatMoney, formatQuantity } from "@/lib/money";
import {
  returnKeys,
  salesKeys,
  STOCK_AFFECTING_KEYS,
} from "@/lib/query/keys";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS } from "@/lib/status";
import { returnsService } from "@/services/returns.service";
import { salesService } from "@/services/sales.service";
import type { PaymentMethod, Sale } from "@/types/domain";

/** How many of a line may still be sent back. */
function returnableQuantity(item: Sale["items"][number]): number {
  return Math.max(item.quantity - item.returnedQuantity, 0);
}

/**
 * Returns always reference an existing sale (§23).
 *
 * There is no way to reach this screen without a receipt number, and no way
 * to return more than was sold. The original sale is never edited — a
 * reversal record is created alongside it.
 */
export function ReturnsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const [receiptInput, setReceiptInput] = useState(
    searchParams.get("receipt") ?? "",
  );
  const [searchedReceipt, setSearchedReceipt] = useState(
    searchParams.get("receipt") ?? "",
  );
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  const [refundMethod, setRefundMethod] = useState<PaymentMethod>("CASH");
  const [confirming, setConfirming] = useState(false);

  const lookup = useQuery({
    queryKey: salesKeys.byReceipt(searchedReceipt),
    queryFn: () => salesService.getByReceiptNumber(searchedReceipt),
    enabled: searchedReceipt.trim().length > 0,
  });

  const sale = lookup.data ?? null;

  const process = useMutation({
    mutationFn: () =>
      returnsService.process({
        saleId: sale!.id,
        items: Object.entries(quantities)
          .filter(([, quantity]) => quantity > 0)
          .map(([saleItemId, quantity]) => ({ saleItemId, quantity })),
        reason: reason.trim(),
        refundMethod,
        userId: user?.id ?? "",
      }),
    onSuccess: (result) => {
      for (const key of STOCK_AFFECTING_KEYS) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
      void queryClient.invalidateQueries({ queryKey: salesKeys.all });
      void queryClient.invalidateQueries({ queryKey: returnKeys.all });

      setConfirming(false);
      toast({
        tone: "success",
        title: "Return recorded",
        description: `${formatMoney(result.refundAmount)} refunded against ${result.receiptNumber}.`,
      });
      router.push(`/sales/${result.saleId}`);
    },
    onError: (error) => {
      setConfirming(false);
      toast({
        tone: "error",
        title: "Could not record the return",
        description: toErrorMessage(error),
      });
    },
  });

  const selected = useMemo(() => {
    if (!sale) return [];
    return sale.items
      .map((item) => ({ item, quantity: quantities[item.id] ?? 0 }))
      .filter((entry) => entry.quantity > 0);
  }, [sale, quantities]);

  const refundAmount = selected.reduce(
    (total, entry) => total + entry.item.unitPrice * entry.quantity,
    0,
  );

  const canSubmit =
    selected.length > 0 && reason.trim().length > 0 && !process.isPending;

  function findReceipt() {
    setSearchedReceipt(receiptInput.trim());
    setQuantities({});
    setReason("");
  }

  function reset() {
    setReceiptInput("");
    setSearchedReceipt("");
    setQuantities({});
    setReason("");
  }

  return (
    <PageContainer>
      <PageHeader
        title="Returns"
        titleHidden
        description="Reverse items against an existing sale. The original sale is never deleted — a reversal is recorded alongside it."
      />

      <Card>
        <CardHeader
          title="Find the sale"
          description="Enter or scan the receipt number from the customer's receipt."
        />
        <CardBody>
          <div className="flex flex-wrap items-end gap-2">
            <FormField label="Receipt number" className="w-full sm:w-72">
              {(ids) => (
                <Input
                  {...ids}
                  value={receiptInput}
                  autoFocus
                  autoComplete="off"
                  placeholder="e.g. MHP-000154"
                  className="num font-mono"
                  onChange={(event) => setReceiptInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      findReceipt();
                    }
                  }}
                />
              )}
            </FormField>

            <Button
              variant="primary"
              onClick={findReceipt}
              disabled={!receiptInput.trim()}
              loading={lookup.isFetching}
              leadingIcon={<Search className="size-4" />}
            >
              Find sale
            </Button>

            {searchedReceipt && (
              <Button
                variant="ghost"
                onClick={reset}
                leadingIcon={<X className="size-4" />}
              >
                Clear
              </Button>
            )}
          </div>
        </CardBody>
      </Card>

      {searchedReceipt && !lookup.isFetching && !sale && (
        <Alert tone="warning" title="No sale found">
          Nothing matches receipt {searchedReceipt}. Check the number on the
          customer&rsquo;s receipt.
        </Alert>
      )}

      {sale?.status === "REVERSED" && (
        <Alert tone="danger" title="This sale has already been fully reversed">
          Every item on {sale.receiptNumber} has been returned. There is
          nothing left to reverse.
        </Alert>
      )}

      {sale && sale.status !== "REVERSED" && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <Card>
            <CardHeader
              title={`Items on ${sale.receiptNumber}`}
              description={`${formatDateTime(sale.createdAt)} · ${sale.cashierName}`}
              actions={<SaleStatusBadge status={sale.status} size="sm" />}
            />

            <div>
              {sale.items.map((item) => {
                const returnable = returnableQuantity(item);
                const quantity = quantities[item.id] ?? 0;

                return (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center gap-3 border-b border-neutral-100 px-4 py-3 last:border-b-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-medium text-neutral-900">
                        {item.productName}
                      </p>
                      <p className="num truncate text-meta text-neutral-500">
                        {item.batchNumber} · sold{" "}
                        {formatQuantity(item.quantity)} @{" "}
                        {formatMoney(item.unitPrice)}
                        {item.returnedQuantity > 0 &&
                          ` · ${formatQuantity(item.returnedQuantity)} already returned`}
                      </p>
                    </div>

                    {returnable === 0 ? (
                      <Badge tone="neutral" size="sm">
                        Fully returned
                      </Badge>
                    ) : (
                      <label className="flex items-center gap-2">
                        <span className="text-meta text-neutral-500">
                          Return
                        </span>
                        <Input
                          type="number"
                          inputSize="sm"
                          min={0}
                          max={returnable}
                          value={quantity || ""}
                          placeholder="0"
                          aria-label={`Quantity of ${item.productName} to return, maximum ${returnable}`}
                          className="num w-20 text-center"
                          onChange={(event) => {
                            // Never allow more back than went out.
                            const next = Math.max(
                              0,
                              Math.min(
                                Number(event.target.value) || 0,
                                returnable,
                              ),
                            );
                            setQuantities((current) => ({
                              ...current,
                              [item.id]: next,
                            }));
                          }}
                        />
                        <span className="num text-meta text-neutral-400">
                          / {formatQuantity(returnable)}
                        </span>
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="h-fit">
            <CardHeader title="Return details" />
            <CardBody className="flex flex-col gap-4">
              <FormField
                label="Reason"
                required
                hint="Recorded against the reversal in the audit log."
              >
                {(ids) => (
                  <Textarea
                    {...ids}
                    rows={3}
                    value={reason}
                    placeholder="e.g. Wrong item dispensed"
                    onChange={(event) => setReason(event.target.value)}
                  />
                )}
              </FormField>

              <FormField label="Refund method" required>
                {(ids) => (
                  <NativeSelect
                    {...ids}
                    value={refundMethod}
                    onChange={(event) =>
                      setRefundMethod(event.target.value as PaymentMethod)
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

              <div className="flex flex-col gap-2 border-t border-neutral-200 pt-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-meta text-neutral-500">
                    Items selected
                  </span>
                  <span className="num text-base text-neutral-900">
                    {formatQuantity(
                      selected.reduce((total, e) => total + e.quantity, 0),
                    )}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-meta font-medium text-neutral-600">
                    Refund amount
                  </span>
                  <span className="num text-title font-bold tabular-nums text-neutral-900">
                    {formatMoney(refundAmount)}
                  </span>
                </div>
              </div>
            </CardBody>

            <CardFooter>
              <Button
                variant="primary"
                fullWidth
                disabled={!canSubmit}
                onClick={() => setConfirming(true)}
                leadingIcon={<RotateCcw className="size-4" />}
              >
                Review return
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {!searchedReceipt && (
        <Card>
          <EmptyState
            icon={<Receipt className="size-5" />}
            title="Start with a receipt"
            description="A return must reference the sale it came from, so find the receipt first."
          />
        </Card>
      )}

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Confirm return"
        confirmLabel="Confirm return"
        confirmVariant="danger"
        loading={process.isPending}
        onConfirm={() => process.mutate()}
        warning="This action will be recorded in the audit history and cannot be undone."
        message={
          <div className="flex flex-col gap-3">
            <p>
              Returning against{" "}
              <span className="num font-medium">{sale?.receiptNumber}</span>:
            </p>

            <ul className="flex flex-col gap-1 rounded-md bg-neutral-50 px-3 py-2.5 ring-1 ring-inset ring-neutral-200">
              {selected.map((entry) => (
                <li
                  key={entry.item.id}
                  className="flex justify-between gap-3 text-meta"
                >
                  <span className="min-w-0 truncate">
                    {formatQuantity(entry.quantity)} × {entry.item.productName}
                  </span>
                  <span className="num shrink-0 font-medium">
                    {formatMoney(entry.item.unitPrice * entry.quantity)}
                  </span>
                </li>
              ))}
            </ul>

            <p className="text-meta text-neutral-600">
              Stock returns to the batch it came from.{" "}
              <span className="font-medium text-neutral-800">
                {formatMoney(refundAmount)}
              </span>{" "}
              will be refunded by{" "}
              {PAYMENT_METHOD_LABELS[refundMethod].toLowerCase()}.
            </p>
          </div>
        }
      />
    </PageContainer>
  );
}
