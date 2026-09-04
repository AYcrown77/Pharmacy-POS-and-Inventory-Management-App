"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { PackagePlus, Warehouse } from "lucide-react";
import { useMemo } from "react";

import { FilterBar, FilterSelect } from "@/components/shared/FilterBar";
import {
  ExpiryStatusBadge,
  StockStatusBadge,
} from "@/components/shared/StatusBadges";
import { Button } from "@/components/ui/Button";
import {
  DataTable,
  EmptyCell,
  NumericCell,
  PrimaryCell,
  type Column,
} from "@/components/ui/DataTable";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { StatCard, StatCardSkeleton } from "@/components/ui/StatCard";
import { EmptyState } from "@/components/ui/States";
import { useTableState } from "@/hooks/useTableState";
import { Can } from "@/lib/auth/AuthProvider";
import { formatDate, formatExpiryRelative } from "@/lib/date";
import { formatMoney, formatMoneyCompact, formatQuantity } from "@/lib/money";
import { inventoryKeys } from "@/lib/query/keys";
import {
  EXPIRY_STATUS_LABELS,
  EXPIRY_STATUS_ORDER,
  STOCK_STATUS_LABELS,
} from "@/lib/status";
import { inventoryService } from "@/services/inventory.service";
import { useCategories } from "@/features/products/hooks";
import type { ExpiryStatus, InventoryItem, StockStatus } from "@/types/domain";

interface InventoryTableFilters {
  categoryId?: string;
  stockStatus?: StockStatus;
  expiryStatus?: ExpiryStatus;
}

export function InventoryPage() {
  const router = useRouter();

  const table = useTableState<InventoryTableFilters>({
    initialSort: { by: "name", dir: "asc" },
    initialFilters: {},
  });

  const list = useQuery({
    queryKey: inventoryKeys.list(table.queryParams),
    queryFn: () => inventoryService.list(table.queryParams),
    placeholderData: keepPreviousData,
  });

  const summary = useQuery({
    queryKey: inventoryKeys.summary(),
    queryFn: () => inventoryService.getSummary(),
  });

  const { data: categories } = useCategories();

  const columns = useMemo<Column<InventoryItem>[]>(
    () => [
      {
        id: "name",
        header: "Product",
        sortable: true,
        cell: (item) => (
          <PrimaryCell
            title={item.product.name}
            subtitle={item.product.genericName ?? undefined}
          />
        ),
      },
      {
        id: "category",
        hideBelow: "xl",
        header: "Category",
        cell: (item) => item.product.category?.name ?? <EmptyCell />,
      },
      {
        id: "availableStock",
        header: "Available",
        align: "right",
        sortable: true,
        width: "108px",
        cell: (item) => (
          <NumericCell muted={item.availableStock === 0}>
            {formatQuantity(item.availableStock)}
          </NumericCell>
        ),
      },
      {
        id: "minimumStockLevel",
        hideBelow: "xl",
        header: "Minimum",
        align: "right",
        width: "100px",
        cell: (item) => (
          <NumericCell muted>
            {formatQuantity(item.minimumStockLevel)}
          </NumericCell>
        ),
      },
      {
        id: "batchCount",
        hideBelow: "xl",
        header: "Batches",
        align: "right",
        width: "92px",
        cell: (item) => (
          <NumericCell muted>{formatQuantity(item.batchCount)}</NumericCell>
        ),
      },
      {
        id: "nearestExpiry",
        header: "Nearest expiry",
        sortable: true,
        width: "168px",
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
        header: "Status",
        width: "150px",
        cell: (item) => (
          <div className="flex flex-wrap items-center gap-1">
            <StockStatusBadge status={item.stockStatus} size="sm" />
            {item.expiryStatus && item.expiryStatus !== "HEALTHY" && (
              <ExpiryStatusBadge status={item.expiryStatus} size="sm" />
            )}
          </div>
        ),
      },
      {
        id: "stockValue",
        header: "Stock value",
        align: "right",
        sortable: true,
        width: "132px",
        cell: (item) => (
          <NumericCell>{formatMoney(item.stockValue)}</NumericCell>
        ),
      },
    ],
    [],
  );

  return (
    <PageContainer>
      <PageHeader
        title="Inventory"
        titleHidden
        description="Stock on hand, aggregated across every batch of each product."
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        {summary.isPending || !summary.data ? (
          Array.from({ length: 5 }, (_, index) => (
            <StatCardSkeleton key={index} size="sm" />
          ))
        ) : (
          <>
            <StatCard
              size="sm"
              label="Products"
              value={formatQuantity(summary.data.totalProducts)}
            />
            <StatCard
              size="sm"
              label="Stock units"
              value={formatQuantity(summary.data.totalStockUnits)}
            />
            <StatCard
              size="sm"
              label="Inventory value"
              value={formatMoneyCompact(summary.data.inventoryValue)}
              context="At cost price"
            />
            <StatCard
              size="sm"
              label="Low stock"
              value={formatQuantity(summary.data.lowStockCount)}
              tone="warning"
              accent={summary.data.lowStockCount > 0}
            />
            <StatCard
              size="sm"
              label="Out of stock"
              value={formatQuantity(summary.data.outOfStockCount)}
              tone="danger"
              accent={summary.data.outOfStockCount > 0}
            />
          </>
        )}
      </div>

      <FilterBar
        search={table.search}
        onSearchChange={table.setSearch}
        searchPlaceholder="Search products"
        hasActiveFilters={table.hasActiveFilters}
        onReset={table.reset}
      >
        <FilterSelect
          label="Category"
          allLabel="All categories"
          value={table.filters.categoryId}
          onChange={(value) => table.setFilter("categoryId", value)}
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
          value={table.filters.stockStatus}
          onChange={(value) => table.setFilter("stockStatus", value)}
          options={(
            ["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"] as StockStatus[]
          ).map((status) => ({
            value: status,
            label: STOCK_STATUS_LABELS[status],
          }))}
        />
        <FilterSelect
          label="Expiry status"
          allLabel="Any expiry status"
          value={table.filters.expiryStatus}
          onChange={(value) => table.setFilter("expiryStatus", value)}
          options={EXPIRY_STATUS_ORDER.map((status) => ({
            value: status,
            label: EXPIRY_STATUS_LABELS[status],
          }))}
        />
      </FilterBar>

      <DataTable
        caption="Inventory by product"
        columns={columns}
        rows={list.data?.data ?? []}
        getRowId={(item) => item.productId}
        isLoading={list.isPending}
        isError={list.isError}
        onRetry={() => void list.refetch()}
        sort={table.sort}
        onSortChange={table.setSort}
        onRowClick={(item) => router.push(`/products/${item.productId}`)}
        className={
          list.isPlaceholderData ? "opacity-60 transition-opacity" : undefined
        }
        empty={
          <EmptyState
            icon={<Warehouse className="size-5" />}
            title={
              table.hasActiveFilters
                ? "No products match these filters"
                : "No inventory yet"
            }
            description={
              table.hasActiveFilters
                ? "Try a different search term or clear the filters."
                : "Receive stock against a product to build up inventory."
            }
            action={
              table.hasActiveFilters ? (
                <Button variant="secondary" onClick={table.reset}>
                  Clear filters
                </Button>
              ) : (
                <Can permission="stock:receive">
                  <Button
                    asChild
                    variant="primary"
                    leadingIcon={<PackagePlus className="size-4" />}
                  >
                    <Link href="/stock/receive">Receive stock</Link>
                  </Button>
                </Can>
              )
            }
          />
        }
      />

      {list.data && list.data.total > 0 && (
        <Pagination
          page={list.data.page}
          pageSize={list.data.pageSize}
          total={list.data.total}
          totalPages={list.data.totalPages}
          onPageChange={table.setPage}
          onPageSizeChange={table.setPageSize}
        />
      )}
    </PageContainer>
  );
}


