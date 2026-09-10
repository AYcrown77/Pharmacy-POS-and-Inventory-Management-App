"use client";

import Link from "next/link";
import { Printer, RotateCcw } from "lucide-react";

import { ReceiptDocument } from "@/components/shared/ReceiptDocument";
import {
  PaymentMethodBadge,
  SaleStatusBadge,
} from "@/components/shared/StatusBadges";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DescriptionList } from "@/components/ui/DescriptionList";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/States";
import { Can } from "@/lib/auth/AuthProvider";
import {
  formatDate,
  formatDateTime,
  formatTime,
  timestampToDateOnly,
} from "@/lib/date";
import { formatMoney, formatQuantity } from "@/lib/money";
import { printReceipt } from "@/lib/print";
import { PAYMENT_METHOD_LABELS } from "@/lib/status";
import { usePharmacySettings, useSale, useSaleReturns } from "./hooks";

export function SaleDetailPage({ saleId }: { saleId: string }) {
  const sale = useSale(saleId);
  const returns = useSaleReturns(saleId);
  const settings = usePharmacySettings();

  if (sale.isError) {
    return (
      <PageContainer>
        <ErrorState
          title="Could not load this sale"
          onRetry={() => void sale.refetch()}
        />
      </PageContainer>
    );
  }

  if (sale.isPending) {
    return (
      <PageContainer>
        <SkeletonCard className="h-28" />
        <SkeletonCard className="h-80" />
      </PageContainer>
    );
  }

  const { data } = sale;
  const refunded = (returns.data ?? []).reduce(
    (total, entry) => total + entry.refundAmount,
    0,
  );

  return (
    <PageContainer>
      <PageHeader
        title={data.receiptNumber}
        breadcrumbs={[
          { label: "Sales", href: "/sales" },
          { label: data.receiptNumber },
        ]}
        description={`${formatDateTime(data.createdAt)} · ${data.cashierName} · ${data.terminalName}`}
        actions={
          <>
            <SaleStatusBadge status={data.status} />
            <Button
              variant="secondary"
              onClick={printReceipt}
              leadingIcon={<Printer className="size-4" />}
            >
              Print receipt
            </Button>
            {data.status !== "REVERSED" && (
              <Can permission="sales:refund">
                <Button
                  asChild
                  variant="primary"
                  leadingIcon={<RotateCcw className="size-4" />}
                >
                  <Link href={`/returns?receipt=${data.receiptNumber}`}>
                    Return items
                  </Link>
                </Button>
              </Can>
            )}
          </>
        }
      />

      {data.status !== "COMPLETED" && (
        <Alert
          tone={data.status === "REVERSED" ? "danger" : "warning"}
          title={
            data.status === "REVERSED"
              ? "This sale has been fully reversed"
              : "Part of this sale has been returned"
          }
        >
          {formatMoney(refunded)} has been refunded across{" "}
          {returns.data?.length ?? 0}{" "}
          {(returns.data?.length ?? 0) === 1 ? "return" : "returns"}. The
          original sale record is kept unchanged.
        </Alert>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader
              title="Items sold"
              description="Batch allocation as recorded by the server at the time of sale."
            />
            <div>
              {/* A grid rather than a table: each line carries two rows of
                  detail, which a table cell handles badly at this density. */}
              <div
                className="grid gap-3 border-b border-neutral-200 bg-neutral-50 px-4 py-2 text-micro font-semibold uppercase tracking-wide text-neutral-500"
                style={{ gridTemplateColumns: ITEM_GRID }}
                aria-hidden
              >
                <span>Product</span>
                <span>Batch</span>
                <span className="text-right">Qty</span>
                <span className="text-right">Unit price</span>
                <span className="text-right">Subtotal</span>
              </div>

              <ul>
                {data.items.map((item) => (
                  <li
                    key={item.id}
                    className="grid items-center gap-3 border-b border-neutral-100 px-4 py-2.5 last:border-b-0"
                    style={{ gridTemplateColumns: ITEM_GRID }}
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/products/${item.productId}`}
                        className="block truncate text-base font-medium text-neutral-900 hover:underline"
                      >
                        {item.productName}
                      </Link>
                      {item.returnedQuantity > 0 && (
                        <Badge tone="info" size="sm">
                          {formatQuantity(item.returnedQuantity)} returned
                        </Badge>
                      )}
                    </div>

                    <span className="num truncate font-mono text-sm text-neutral-600">
                      {item.batchNumber}
                    </span>

                    <span className="num text-right text-base text-neutral-900">
                      {formatQuantity(item.quantity)}
                      {item.unitsPerSaleUnit > 1 && (
                        <span className="block text-micro text-neutral-500">
                          {item.quantity === 1 ? "pack" : "packs"} of{" "}
                          {item.unitsPerSaleUnit}
                        </span>
                      )}
                    </span>

                    <span className="num text-right text-base text-neutral-600">
                      {formatMoney(item.unitPrice)}
                    </span>

                    <span className="num text-right text-base font-semibold text-neutral-900">
                      {formatMoney(item.subtotal)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>

          {(returns.data?.length ?? 0) > 0 && (
            <Card>
              <CardHeader
                title="Reversal history"
                description="Returns recorded against this sale."
              />
              <div>
                {returns.data?.map((entry) => (
                  <div
                    key={entry.id}
                    className="border-b border-neutral-100 px-4 py-3 last:border-b-0"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-base font-medium text-neutral-900">
                        {formatMoney(entry.refundAmount)} refunded by{" "}
                        {entry.processedByName}
                      </span>
                      <span className="num text-meta text-neutral-500">
                        {formatDateTime(entry.createdAt)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-meta text-neutral-600">
                      {entry.reason} ·{" "}
                      {PAYMENT_METHOD_LABELS[entry.refundMethod]}
                    </p>
                    <ul className="mt-1.5 flex flex-col gap-0.5">
                      {entry.items.map((item) => (
                        <li
                          key={item.saleItemId}
                          className="num text-meta text-neutral-500"
                        >
                          {formatQuantity(item.quantity)} × {item.productName}{" "}
                          <span className="font-mono">({item.batchNumber})</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Payment" />
            <CardBody className="flex flex-col gap-2.5">
              <Row label="Subtotal" value={formatMoney(data.subtotal)} />
              {data.discount > 0 && (
                <Row label="Discount" value={`− ${formatMoney(data.discount)}`} />
              )}
              <div className="flex items-baseline justify-between gap-3 border-t border-neutral-200 pt-2.5">
                <span className="text-meta font-medium text-neutral-600">
                  Total
                </span>
                <span className="num text-title font-bold tabular-nums text-neutral-900">
                  {formatMoney(data.total)}
                </span>
              </div>

              <div className="mt-1 flex items-center justify-between gap-3">
                <span className="text-meta text-neutral-500">Method</span>
                <PaymentMethodBadge method={data.paymentMethod} size="sm" />
              </div>

              {data.amountReceived !== null && (
                <>
                  <Row
                    label="Received"
                    value={formatMoney(data.amountReceived)}
                  />
                  <Row
                    label="Change given"
                    value={formatMoney(data.changeGiven ?? 0)}
                  />
                </>
              )}

              {refunded > 0 && (
                <Row label="Refunded" value={`− ${formatMoney(refunded)}`} />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Receipt details" />
            <CardBody>
              <DescriptionList
                columns={1}
                items={[
                  { label: "Receipt number", value: data.receiptNumber },
                  { label: "Cashier", value: data.cashierName },
                  { label: "Terminal", value: data.terminalName },
                  {
                    label: "Date",
                    value: formatDate(timestampToDateOnly(data.createdAt)),
                  },
                  { label: "Time", value: formatTime(data.createdAt) },
                ]}
              />
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Off-screen; the print stylesheet reveals only this. */}
      <ReceiptDocument sale={data} settings={settings.data} />
    </PageContainer>
  );
}

const ITEM_GRID = "minmax(0,1fr) 9rem 4rem 7rem 8rem";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-meta text-neutral-500">{label}</span>
      <span className="num text-base tabular-nums text-neutral-900">
        {value}
      </span>
    </div>
  );
}
