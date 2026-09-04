"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { CheckCircle2, SlidersHorizontal } from "lucide-react";
import { useMemo } from "react";

import { FilterBar, FilterSelect } from "@/components/shared/FilterBar";
import { ExpiryStatusBadge } from "@/components/shared/StatusBadges";
import { Button } from "@/components/ui/Button";
import {
  DataTable,
  NumericCell,
  PrimaryCell,
  type Column,
} from "@/components/ui/DataTable";
import { RowActions } from "@/components/ui/DropdownMenu";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/States";
import { useTableState } from "@/hooks/useTableState";
import { useCan } from "@/lib/auth/AuthProvider";
import { cn } from "@/lib/cn";
import { formatDate, formatExpiryRelative } from "@/lib/date";
import { formatMoney, formatQuantity } from "@/lib/money";
import { batchKeys } from "@/lib/query/keys";
import {
  EXPIRY_STATUS_ORDER,
  EXPIRY_STATUS_RANGE_LABELS,
} from "@/lib/status";
import { useCategories } from "@/features/products/hooks";
import { inventoryService } from "@/services/inventory.service";
import type { ExpiryAlertItem } from "@/types/analytics";
import type { ExpiryStatus } from "@/types/domain";

interface ExpiryTableFilters {
  expiryStatus?: ExpiryStatus;
  categoryId?: string;
}

/** Chip styling per band — the strongest signal sits on Expired. */
const BAND_STYLES: Record<ExpiryStatus, { idle: string; active: string }> = {
  EXPIRED: {
    idle: "bg-white text-danger-700 ring-danger-200 hover:bg-danger-50",
    active: "bg-danger-600 text-white ring-danger-600",
  },
  CRITICAL_30: {
    idle: "bg-white text-danger-700 ring-danger-200 hover:bg-danger-50",
    active: "bg-danger-50 text-danger-800 ring-danger-400",
  },
  WARNING_60: {
    idle: "bg-white text-warning-700 ring-warning-200 hover:bg-warning-50",
    active: "bg-warning-50 text-warning-800 ring-warning-400",
  },
  NOTICE_90: {
    idle: "bg-white text-warning-700 ring-warning-200 hover:bg-warning-50",
    active: "bg-warning-50 text-warning-800 ring-warning-300",
  },
  HEALTHY: {
    idle: "bg-white text-success-700 ring-success-200 hover:bg-success-50",
    active: "bg-success-50 text-success-800 ring-success-400",
  },
};

export function ExpiryPage() {
  const router = useRouter();
  const canAdjust = useCan("stock:adjust");

  const table = useTableState<ExpiryTableFilters>({
    // Soonest first: this page exists to catch stock before it is lost.
    initialSort: { by: "daysUntilExpiry", dir: "asc" },
    initialFilters: {},
  });

  const list = useQuery({
    queryKey: batchKeys.expiry(table.queryParams),
    queryFn: () => inventoryService.listExpiring(table.queryParams),
    placeholderData: keepPreviousData,
  });

  const summary = useQuery({
    queryKey: batchKeys.expirySummary(),
    queryFn: () => inventoryService.getExpirySummary(),
  });

  const { data: categories } = useCategories();

  const columns = useMemo<Column<ExpiryAlertItem>[]>(
    () => [
      {
        id: "product",
        header: "Product",
        width: "26%",
        cell: (item) => (
          <PrimaryCell title={item.productName} subtitle={item.batchNumber} />
        ),
      },
      {
        id: "quantity",
        header: "Quantity",
        align: "right",
        sortable: true,
        width: "10%",
        cell: (item) => (
          <NumericCell>{formatQuantity(item.quantityRemaining)}</NumericCell>
        ),
      },
      {
        id: "daysUntilExpiry",
        header: "Expiry date",
        sortable: true,
        width: "18%",
        cell: (item) => (
          <div className="flex flex-col whitespace-nowrap">
            <span className="num">{formatDate(item.expiryDate)}</span>
            <span
              className={cn(
                "text-meta",
                item.daysUntilExpiry < 0
                  ? "font-medium text-danger-700"
                  : item.daysUntilExpiry <= 30
                    ? "font-medium text-danger-600"
                    : "text-neutral-500",
              )}
            >
              {formatExpiryRelative(item.expiryDate)}
            </span>
          </div>
        ),
      },
      {
        id: "stockValue",
        header: "Stock value",
        align: "right",
        sortable: true,
        width: "13%",
        cell: (item) => (
          <NumericCell
            className={item.daysUntilExpiry < 0 ? "text-danger-700" : undefined}
          >
            {formatMoney(item.stockValue)}
          </NumericCell>
        ),
      },
      {
        id: "status",
        header: "Status",
        width: "14%",
        cell: (item) => <ExpiryStatusBadge status={item.expiryStatus} size="sm" />,
      },
      {
        id: "actions",
        header: <span className="sr-only">Actions</span>,
        align: "right",
        width: "48px",
        cell: (item) => (
          <RowActions
            label={`Actions for ${item.productName} batch ${item.batchNumber}`}
            actions={[
              {
                id: "view",
                label: "View product",
                onSelect: () => router.push(`/products/${item.productId}`),
              },
              ...(canAdjust
                ? [
                    {
                      id: "adjust",
                      label:
                        item.daysUntilExpiry < 0
                          ? "Write off expired stock"
                          : "Adjust stock",
                      icon: <SlidersHorizontal className="size-4" />,
                      tone: "danger" as const,
                      separated: true,
                      onSelect: () =>
                        router.push(
                          `/stock/adjustments?productId=${item.productId}&batchId=${item.batchId}&reason=${
                            item.daysUntilExpiry < 0 ? "EXPIRED" : "DAMAGED"
                          }`,
                        ),
                    },
                  ]
                : []),
            ]}
          />
        ),
      },
    ],
    [router, canAdjust],
  );

  const totalAtRisk = useMemo(() => {
    const rows = list.data?.data ?? [];
    return rows
      .filter((item) => item.daysUntilExpiry <= 90)
      .reduce((total, item) => total + item.stockValue, 0);
  }, [list.data]);

  return (
    <PageContainer>
      <PageHeader
        title="Expiry management"
        titleHidden
        description="Batches by remaining shelf life. Acting early on the red bands is what prevents write-offs."
      />

      {/* Bands double as filters — the count and the filter are the same idea. */}
      <div className="flex flex-wrap gap-2">
        {EXPIRY_STATUS_ORDER.map((status) => {
          const active = table.filters.expiryStatus === status;
          const count = summary.data?.[status];

          return (
            <button
              key={status}
              type="button"
              aria-pressed={active}
              onClick={() =>
                table.setFilter("expiryStatus", active ? undefined : status)
              }
              className={cn(
                "inline-flex items-center gap-2 rounded-md px-3 py-2 text-base font-medium ring-1 ring-inset transition-colors",
                active ? BAND_STYLES[status].active : BAND_STYLES[status].idle,
              )}
            >
              {EXPIRY_STATUS_RANGE_LABELS[status]}
              {summary.isPending ? (
                <Skeleton className="h-3 w-5" />
              ) : (
                <span className="num font-semibold">
                  {formatQuantity(count ?? 0)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <FilterBar
        search={table.search}
        onSearchChange={table.setSearch}
        searchPlaceholder="Search product, batch or supplier"
        hasActiveFilters={table.hasActiveFilters}
        onReset={table.reset}
        trailing={
          totalAtRisk > 0 ? (
            <span className="text-meta text-neutral-500">
              Value on this page within 90 days:{" "}
              <span className="num font-semibold text-neutral-800">
                {formatMoney(totalAtRisk)}
              </span>
            </span>
          ) : undefined
        }
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
      </FilterBar>

      <DataTable
        caption="Batches by expiry"
        columns={columns}
        rows={list.data?.data ?? []}
        getRowId={(item) => item.batchId}
        isLoading={list.isPending}
        isError={list.isError}
        onRetry={() => void list.refetch()}
        sort={table.sort}
        onSortChange={table.setSort}
        density="compact"
        rowClassName={(item) =>
          item.daysUntilExpiry < 0
            ? "bg-danger-50/50"
            : item.daysUntilExpiry <= 30
              ? "bg-danger-50/25"
              : undefined
        }
        className={
          list.isPlaceholderData ? "opacity-60 transition-opacity" : undefined
        }
        empty={
          <EmptyState
            icon={<CheckCircle2 className="size-5 text-success-500" />}
            title={
              table.hasActiveFilters
                ? "No batches match these filters"
                : "Nothing to worry about"
            }
            description={
              table.hasActiveFilters
                ? "Try a different band, or clear the filters."
                : "No batch is approaching its expiry date."
            }
            action={
              table.hasActiveFilters ? (
                <Button variant="secondary" onClick={table.reset}>
                  Clear filters
                </Button>
              ) : undefined
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
