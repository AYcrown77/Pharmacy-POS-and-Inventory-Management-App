"use client";

import { useQuery } from "@tanstack/react-query";
import { Warehouse } from "lucide-react";
import { useMemo, useState } from "react";

import { FilterSelect } from "@/components/shared/FilterBar";
import { StockStatusBadge } from "@/components/shared/StatusBadges";
import {
  DataTable,
  EmptyCell,
  NumericCell,
  PrimaryCell,
  type Column,
} from "@/components/ui/DataTable";
import { SearchInput } from "@/components/ui/Input";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useDebounce } from "@/hooks/useDebounce";
import { formatDate, formatExpiryRelative } from "@/lib/date";
import { formatMoney, formatMoneyCompact, formatQuantity } from "@/lib/money";
import { inventoryKeys } from "@/lib/query/keys";
import { STOCK_STATUS_LABELS } from "@/lib/status";
import { inventoryService } from "@/services/inventory.service";
import { useCategories } from "@/features/products/hooks";
import type { InventoryItem, StockStatus } from "@/types/domain";
import { ReportShell, ReportSummary } from "./components/ReportShell";

export function InventoryReportPage() {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [stockStatus, setStockStatus] = useState<StockStatus | undefined>();

  const debounced = useDebounce(search);
  const filters = {
    search: debounced.trim() || undefined,
    categoryId,
    stockStatus,
    pageSize: 200,
  };

  const list = useQuery({
    queryKey: inventoryKeys.list(filters),
    queryFn: () => inventoryService.list(filters),
  });

  const summary = useQuery({
    queryKey: inventoryKeys.summary(),
    queryFn: () => inventoryService.getSummary(),
  });

  const { data: categories } = useCategories();

  const columns = useMemo<Column<InventoryItem>[]>(
    () => [
      {
        id: "product",
        header: "Product",
        width: "27%",
        cell: (item) => (
          <PrimaryCell
            title={item.product.name}
            subtitle={item.product.category?.name ?? undefined}
          />
        ),
      },
      {
        id: "availableStock",
        header: "Available",
        align: "right",
        width: "11%",
        cell: (item) => (
          <NumericCell muted={item.availableStock === 0}>
            {formatQuantity(item.availableStock)}
          </NumericCell>
        ),
      },
      {
        id: "minimum",
        header: "Minimum",
        align: "right",
        width: "10%",
        cell: (item) => (
          <NumericCell muted>
            {formatQuantity(item.minimumStockLevel)}
          </NumericCell>
        ),
      },
      {
        id: "batchCount",
        header: "Batches",
        align: "right",
        width: "9%",
        cell: (item) => (
          <NumericCell muted>{formatQuantity(item.batchCount)}</NumericCell>
        ),
      },
      {
        id: "nearestExpiry",
        header: "Nearest expiry",
        width: "18%",
        cell: (item) =>
          item.nearestExpiry ? (
            <div className="flex flex-col whitespace-nowrap">
              <span className="num">{formatDate(item.nearestExpiry)}</span>
              <span className="text-meta text-neutral-500">
                {formatExpiryRelative(item.nearestExpiry)}
              </span>
            </div>
          ) : (
            <EmptyCell />
          ),
      },
      {
        id: "status",
        header: "Stock status",
        width: "13%",
        cell: (item) => <StockStatusBadge status={item.stockStatus} size="sm" />,
      },
      {
        id: "stockValue",
        header: "Stock value",
        align: "right",
        width: "12%",
        cell: (item) => (
          <NumericCell className="font-semibold">
            {formatMoney(item.stockValue)}
          </NumericCell>
        ),
      },
    ],
    [],
  );

  return (
    <ReportShell
      title="Inventory report"
      description="Stock on hand and its value across the catalogue."
      filters={
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-full min-w-48 sm:w-64">
            <SearchInput
              inputSize="sm"
              value={search}
              placeholder="Search products"
              aria-label="Search products"
              onChange={(event) => setSearch(event.target.value)}
              onClear={() => setSearch("")}
            />
          </div>
          <FilterSelect
            label="Category"
            allLabel="All categories"
            value={categoryId}
            onChange={setCategoryId}
            options={
              categories?.map((category) => ({
                value: category.id,
                label: category.name,
              })) ?? []
            }
          />
          <FilterSelect
            label="Stock status"
            allLabel="Any stock status"
            value={stockStatus}
            onChange={setStockStatus}
            options={(
              ["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"] as StockStatus[]
            ).map((status) => ({
              value: status,
              label: STOCK_STATUS_LABELS[status],
            }))}
          />
        </div>
      }
      summary={
        summary.isError ? (
          <ErrorState onRetry={() => void summary.refetch()} className="py-8" />
        ) : (
          <ReportSummary
            columns={5}
            isPending={summary.isPending}
            items={[
              {
                label: "Total products",
                value: formatQuantity(summary.data?.totalProducts ?? 0),
              },
              {
                label: "Total units",
                value: formatQuantity(summary.data?.totalStockUnits ?? 0),
              },
              {
                label: "Inventory value",
                value: formatMoneyCompact(summary.data?.inventoryValue ?? 0),
                context: "At cost price",
              },
              {
                label: "Low stock",
                value: formatQuantity(summary.data?.lowStockCount ?? 0),
                tone: "warning",
                accent: (summary.data?.lowStockCount ?? 0) > 0,
              },
              {
                label: "Out of stock",
                value: formatQuantity(summary.data?.outOfStockCount ?? 0),
                tone: "danger",
                accent: (summary.data?.outOfStockCount ?? 0) > 0,
              },
            ]}
          />
        )
      }
    >
      <DataTable
        caption="Inventory by product"
        columns={columns}
        rows={list.data?.data ?? []}
        getRowId={(item) => item.productId}
        isLoading={list.isPending}
        isError={list.isError}
        onRetry={() => void list.refetch()}
        density="compact"
        empty={
          <EmptyState
            icon={<Warehouse className="size-5" />}
            title="No products match these filters"
          />
        }
      />
    </ReportShell>
  );
}
