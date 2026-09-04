"use client";

import { Receipt, Warehouse } from "lucide-react";

import {
  MovementTypeBadge,
  PaymentMethodBadge,
  QuantityDelta,
  SaleStatusBadge,
} from "@/components/shared/StatusBadges";
import { formatRelativeTime, formatTime } from "@/lib/date";
import { formatMoney, formatQuantity } from "@/lib/money";
import { useRecentMovements, useRecentSales } from "../hooks";
import { DashboardPanel, PanelRow } from "./DashboardPanel";

export function RecentSalesPanel({ limit = 6 }: { limit?: number }) {
  const { data, isPending, isError, refetch } = useRecentSales(limit);

  return (
    <DashboardPanel
      title="Recent transactions"
      description="Latest completed sales"
      href="/sales"
      isLoading={isPending}
      isError={isError}
      onRetry={() => void refetch()}
      isEmpty={data?.length === 0}
      emptyIcon={<Receipt className="size-5" />}
      emptyTitle="No sales yet"
      emptyDescription="Completed sales appear here as they are rung up."
    >
      <div>
        {data?.map((sale) => (
          <PanelRow key={sale.id} href={`/sales/${sale.id}`}>
            <div className="min-w-0 flex-1">
              <p className="num truncate font-medium text-neutral-900">
                {sale.receiptNumber}
              </p>
              <p className="truncate text-meta text-neutral-500">
                {sale.cashierName} · {formatQuantity(sale.itemCount)}{" "}
                {sale.itemCount === 1 ? "item" : "items"} ·{" "}
                {formatTime(sale.createdAt)}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {sale.status !== "COMPLETED" && (
                <SaleStatusBadge status={sale.status} size="sm" />
              )}
              <PaymentMethodBadge method={sale.paymentMethod} size="sm" />
              <span className="num w-20 text-right font-semibold text-neutral-900">
                {formatMoney(sale.total)}
              </span>
            </div>
          </PanelRow>
        ))}
      </div>
    </DashboardPanel>
  );
}

/**
 * The stock ledger, most recent first.
 *
 * Note the deliberate restraint on colour: a sale leaving stock is badged
 * neutral, because it is routine. Only damage and expiry read as problems.
 */
export function RecentActivityPanel({ limit = 6 }: { limit?: number }) {
  const { data, isPending, isError, refetch } = useRecentMovements(limit);

  return (
    <DashboardPanel
      title="Stock activity"
      description="How inventory moved most recently"
      href="/reports/stock-movements"
      linkLabel="View ledger"
      isLoading={isPending}
      isError={isError}
      onRetry={() => void refetch()}
      isEmpty={data?.length === 0}
      emptyIcon={<Warehouse className="size-5" />}
      emptyTitle="No stock movements"
      emptyDescription="Receiving, sales and adjustments appear here."
    >
      <div>
        {data?.map((movement) => (
          <PanelRow key={movement.id}>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-neutral-900">
                {movement.productName}
              </p>
              <p className="num truncate text-meta text-neutral-500">
                {movement.batchNumber ? `${movement.batchNumber} · ` : ""}
                {movement.userName} · {formatRelativeTime(movement.createdAt)}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-3">
              <MovementTypeBadge type={movement.movementType} size="sm" />
              <span className="w-16 text-right">
                <QuantityDelta
                  value={movement.quantity}
                  tone={movement.movementType === "SALE" ? "neutral" : "auto"}
                />
              </span>
            </div>
          </PanelRow>
        ))}
      </div>
    </DashboardPanel>
  );
}
