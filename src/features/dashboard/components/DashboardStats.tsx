"use client";

import {
  AlertTriangle,
  Ban,
  Boxes,
  CalendarClock,
  Pill,
  Receipt,
  TrendingDown,
  Wallet,
} from "lucide-react";

import { StatCard, StatCardSkeleton, TrendIndicator } from "@/components/ui/StatCard";
import { ErrorState } from "@/components/ui/States";
import { formatMoney, formatMoneyCompact, formatQuantity } from "@/lib/money";
import type { DashboardSummary } from "@/types/analytics";

/**
 * Two rows, deliberately unequal.
 *
 * The first four are what an administrator checks on arrival. The second row
 * is standing context, so it is rendered smaller — the visual weight matches
 * how often the figure is actually acted on.
 *
 * Colour appears only when a figure represents work to do AND is non-zero.
 * Nothing expiring is good news and should look calm, not green.
 */
export function DashboardStats({
  data,
  isPending,
  isError,
  onRetry,
}: {
  data: DashboardSummary | undefined;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  if (isError) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white">
        <ErrorState
          title="Could not load today's figures"
          onRetry={onRetry}
          className="py-10"
        />
      </div>
    );
  }

  if (isPending || !data) {
    return (
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <StatCardSkeleton key={index} />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <StatCardSkeleton key={index} size="sm" />
          ))}
        </div>
      </div>
    );
  }

  const { inventory } = data;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label="Today's Sales"
          value={formatMoney(data.todaySales)}
          icon={<Wallet className="size-4" />}
          context={
            <TrendIndicator
              percent={data.salesChangePercent}
              label="vs yesterday"
            />
          }
        />

        <StatCard
          label="Transactions"
          value={formatQuantity(data.todayTransactions)}
          icon={<Receipt className="size-4" />}
          context={
            data.todayTransactions > 0
              ? `${formatMoneyCompact(data.todayAverageSale)} average sale`
              : "No sales recorded yet today"
          }
        />

        <StatCard
          label="Low Stock"
          value={formatQuantity(inventory.lowStockCount)}
          icon={<TrendingDown className="size-4" />}
          tone="warning"
          accent={inventory.lowStockCount > 0}
          context={
            inventory.lowStockCount > 0
              ? "Products at or below minimum"
              : "All products above minimum"
          }
        />

        <StatCard
          label="Expiring Soon"
          value={formatQuantity(inventory.expiringSoonCount)}
          icon={<CalendarClock className="size-4" />}
          tone="warning"
          accent={inventory.expiringSoonCount > 0}
          context={
            inventory.expiringSoonCount > 0
              ? "Batches within 90 days"
              : "No batches within 90 days"
          }
        />
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          size="sm"
          label="Total Products"
          value={formatQuantity(inventory.totalProducts)}
          icon={<Pill className="size-4" />}
          context={`${formatMoneyCompact(inventory.inventoryValue)} stock value`}
        />

        <StatCard
          size="sm"
          label="Stock Units"
          value={formatQuantity(inventory.totalStockUnits)}
          icon={<Boxes className="size-4" />}
          context="Sellable units on hand"
        />

        <StatCard
          size="sm"
          label="Out of Stock"
          value={formatQuantity(inventory.outOfStockCount)}
          icon={<Ban className="size-4" />}
          tone="danger"
          accent={inventory.outOfStockCount > 0}
          context={
            inventory.outOfStockCount > 0
              ? "Cannot be sold"
              : "Everything in stock"
          }
        />

        <StatCard
          size="sm"
          label="Expired Stock"
          value={formatQuantity(inventory.expiredCount)}
          icon={<AlertTriangle className="size-4" />}
          tone="danger"
          accent={inventory.expiredCount > 0}
          context={
            inventory.expiredCount > 0
              ? "Batches to write off"
              : "No expired batches"
          }
        />
      </div>
    </div>
  );
}
