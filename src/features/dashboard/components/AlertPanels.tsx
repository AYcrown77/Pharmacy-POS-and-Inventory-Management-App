"use client";

import { CheckCircle2, PackageCheck } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { ExpiryStatusBadge } from "@/components/shared/StatusBadges";
import { formatExpiryRelative } from "@/lib/date";
import { formatMoneyCompact, formatQuantity } from "@/lib/money";
import { STOCK_STATUS_LABELS, STOCK_STATUS_TONES } from "@/lib/status";
import { useExpiryAlerts, useLowStockAlerts } from "../hooks";
import { DashboardPanel, PanelRow } from "./DashboardPanel";

/**
 * Batches running out of shelf life, soonest first.
 * This is the panel that saves the pharmacy money.
 */
export function ExpiryAlertsPanel({ limit = 6 }: { limit?: number }) {
  const { data, isPending, isError, refetch } = useExpiryAlerts(limit);

  return (
    <DashboardPanel
      title="Expiry alerts"
      description="Batches within 90 days, soonest first"
      href="/expiry"
      isLoading={isPending}
      isError={isError}
      onRetry={() => void refetch()}
      isEmpty={data?.length === 0}
      emptyIcon={<CheckCircle2 className="size-5 text-success-500" />}
      emptyTitle="Nothing expiring soon"
      emptyDescription="No batch expires within the next 90 days."
    >
      <div>
        {data?.map((alert) => (
          <PanelRow key={alert.batchId} href="/expiry">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-neutral-900">
                {alert.productName}
              </p>
              <p className="num truncate text-meta text-neutral-500">
                {alert.batchNumber} · {formatQuantity(alert.quantityRemaining)}{" "}
                units · {formatMoneyCompact(alert.stockValue)}
              </p>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-1">
              <ExpiryStatusBadge status={alert.expiryStatus} size="sm" />
              <span className="num text-micro text-neutral-500">
                {formatExpiryRelative(alert.expiryDate)}
              </span>
            </div>
          </PanelRow>
        ))}
      </div>
    </DashboardPanel>
  );
}

/**
 * Products at or below their minimum stock level, worst shortfall first —
 * which is the order they need reordering in.
 */
export function LowStockPanel({ limit = 6 }: { limit?: number }) {
  const { data, isPending, isError, refetch } = useLowStockAlerts(limit);

  return (
    <DashboardPanel
      title="Low stock"
      description="At or below the minimum level"
      href="/inventory"
      linkLabel="View inventory"
      isLoading={isPending}
      isError={isError}
      onRetry={() => void refetch()}
      isEmpty={data?.length === 0}
      emptyIcon={<PackageCheck className="size-5 text-success-500" />}
      emptyTitle="Stock levels are healthy"
      emptyDescription="Every product is above its minimum stock level."
    >
      <div>
        {data?.map((item) => (
          <PanelRow
            key={item.productId}
            href={`/stock/receive?productId=${item.productId}`}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-neutral-900">
                {item.productName}
              </p>
              <p className="truncate text-meta text-neutral-500">
                {item.categoryName ?? "Uncategorised"}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-3">
              <span className="num text-right text-meta text-neutral-500">
                <span className="font-semibold text-neutral-900">
                  {formatQuantity(item.availableStock)}
                </span>
                {" / "}
                {formatQuantity(item.minimumStockLevel)}
              </span>
              <Badge
                tone={STOCK_STATUS_TONES[item.stockStatus]}
                size="sm"
                dot
              >
                {STOCK_STATUS_LABELS[item.stockStatus]}
              </Badge>
            </div>
          </PanelRow>
        ))}
      </div>
    </DashboardPanel>
  );
}
