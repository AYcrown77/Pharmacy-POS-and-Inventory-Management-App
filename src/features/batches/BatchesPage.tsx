"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Boxes, PackagePlus } from "lucide-react";
import { useMemo } from "react";

import { FilterBar, FilterSelect } from "@/components/shared/FilterBar";
import { ExpiryStatusBadge } from "@/components/shared/StatusBadges";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  DataTable,
  EmptyCell,
  NumericCell,
  PrimaryCell,
  type Column,
} from "@/components/ui/DataTable";
import { NativeSelect } from "@/components/ui/Input";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/States";
import { useTableState } from "@/hooks/useTableState";
import { Can } from "@/lib/auth/AuthProvider";
import { formatDate, formatExpiryRelative } from "@/lib/date";
import { formatMoney, formatQuantity } from "@/lib/money";
import { batchKeys } from "@/lib/query/keys";
import { EXPIRY_STATUS_LABELS, EXPIRY_STATUS_ORDER } from "@/lib/status";
import { inventoryService } from "@/services/inventory.service";
import type { Batch, ExpiryStatus } from "@/types/domain";

interface BatchTableFilters {
  expiryStatus?: ExpiryStatus;
  onlyInStock?: boolean;
}

export function BatchesPage() {
  const router = useRouter();

  const table = useTableState<BatchTableFilters>({
    // Soonest expiry first — the same order stock is drawn in.
    initialSort: { by: "expiryDate", dir: "asc" },
    initialFilters: { onlyInStock: true },
  });

  const list = useQuery({
    queryKey: batchKeys.list(table.queryParams),
    queryFn: () => inventoryService.listBatches(table.queryParams),
    placeholderData: keepPreviousData,
  });

  /**
   * Within each product, the earliest-expiring batch that still has stock is
   * the one a sale would draw from next. Marked here for clarity only — the
   * server decides the real allocation when the sale is committed.
   */
  const nextForSaleIds = useMemo(() => {
    const rows = list.data?.data ?? [];
    const seen = new Set<string>();
    const ids = new Set<string>();

    for (const batch of [...rows].sort((a, b) =>
      a.expiryDate.localeCompare(b.expiryDate),
    )) {
      if (batch.quantityRemaining <= 0 || batch.daysUntilExpiry < 0) continue;
      if (seen.has(batch.productId)) continue;
      seen.add(batch.productId);
      ids.add(batch.id);
    }

    return ids;
  }, [list.data]);

  const columns = useMemo<Column<Batch>[]>(
    () => [
      {
        id: "product",
        header: "Product",
        sortable: true,
        cell: (batch) => (
          <div className="flex min-w-0 items-center gap-2">
            <PrimaryCell
              title={batch.product?.name ?? "Unknown product"}
              subtitle={batch.product?.strength ?? undefined}
            />
            {nextForSaleIds.has(batch.id) && (
              <Badge
                tone="primary"
                size="sm"
                className="hidden shrink-0 xl:inline-flex"
              >
                Next
              </Badge>
            )}
          </div>
        ),
      },
      {
        id: "batchNumber",
        header: "Batch",
        width: "104px",
        cell: (batch) => (
          <span className="num font-mono text-sm text-neutral-700">
            {batch.batchNumber}
          </span>
        ),
      },
      {
        id: "quantityRemaining",
        header: "Remaining",
        align: "right",
        sortable: true,
        width: "108px",
        cell: (batch) => (
          <NumericCell muted={batch.quantityRemaining === 0}>
            {formatQuantity(batch.quantityRemaining)}
            <span className="text-neutral-400">
              {" / "}
              {formatQuantity(batch.quantityReceived)}
            </span>
          </NumericCell>
        ),
      },
      {
        // Expiry date and days-remaining share a column: they are one fact,
        // and the specification's eleven separate columns cannot fit 1366px.
        id: "expiryDate",
        header: "Expiry",
        sortable: true,
        width: "150px",
        cell: (batch) => (
          <div className="flex flex-col whitespace-nowrap">
            <span className="num">{formatDate(batch.expiryDate)}</span>
            <span className="text-meta text-neutral-500">
              {formatExpiryRelative(batch.expiryDate)}
            </span>
          </div>
        ),
      },
      {
        id: "costPrice",
        hideBelow: "xl",
        header: "Cost",
        align: "right",
        width: "104px",
        cell: (batch) => (
          <NumericCell muted>{formatMoney(batch.costPrice)}</NumericCell>
        ),
      },
      {
        id: "sellingPrice",
        header: "Selling",
        align: "right",
        width: "100px",
        cell: (batch) => (
          <NumericCell>{formatMoney(batch.sellingPrice)}</NumericCell>
        ),
      },
      {
        id: "supplierName",
        hideBelow: "xl",
        header: "Supplier",
        width: "150px",
        cell: (batch) => (
          <div className="flex min-w-0 flex-col">
            {/* Truncated to fit; the full name is available on hover. */}
            <span className="truncate" title={batch.supplierName ?? undefined}>
              {batch.supplierName ?? <EmptyCell />}
            </span>
            <span className="num whitespace-nowrap text-meta text-neutral-500">
              {formatDate(batch.receivedAt.slice(0, 10))}
            </span>
          </div>
        ),
      },
      {
        id: "status",
        header: "Status",
        width: "124px",
        cell: (batch) => (
          <ExpiryStatusBadge status={batch.expiryStatus} size="sm" />
        ),
      },
    ],
    [nextForSaleIds],
  );

  return (
    <PageContainer>
      <PageHeader
        title="Batches"
        titleHidden
        description="Every lot of stock, with its expiry date and remaining quantity. Sales draw from the earliest expiry first."
        actions={
          <Can permission="stock:receive">
            <Button
              asChild
              variant="primary"
              leadingIcon={<PackagePlus className="size-4" />}
            >
              <Link href="/stock/receive">Receive stock</Link>
            </Button>
          </Can>
        }
      />

      <FilterBar
        search={table.search}
        onSearchChange={table.setSearch}
        searchPlaceholder="Search product, batch or supplier"
        hasActiveFilters={
          table.search.trim().length > 0 ||
          table.filters.expiryStatus !== undefined ||
          table.filters.onlyInStock !== true
        }
        onReset={table.reset}
      >
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

        <label className="shrink-0">
          <span className="sr-only">Stock filter</span>
          <NativeSelect
            selectSize="sm"
            value={table.filters.onlyInStock ? "in-stock" : "all"}
            onChange={(event) =>
              table.setFilter("onlyInStock", event.target.value === "in-stock")
            }
            className="w-auto min-w-40"
          >
            <option value="in-stock">With stock remaining</option>
            <option value="all">Include depleted batches</option>
          </NativeSelect>
        </label>
      </FilterBar>

      <DataTable
        caption="Stock batches"
        columns={columns}
        rows={list.data?.data ?? []}
        getRowId={(batch) => batch.id}
        isLoading={list.isPending}
        isError={list.isError}
        onRetry={() => void list.refetch()}
        sort={table.sort}
        onSortChange={table.setSort}
        onRowClick={(batch) => router.push(`/products/${batch.productId}`)}
        density="compact"
        rowClassName={(batch) =>
          batch.expiryStatus === "EXPIRED"
            ? "bg-danger-50/40"
            : batch.quantityRemaining === 0
              ? "opacity-55"
              : undefined
        }
        className={
          list.isPlaceholderData ? "opacity-60 transition-opacity" : undefined
        }
        empty={
          <EmptyState
            icon={<Boxes className="size-5" />}
            title={
              table.hasActiveFilters
                ? "No batches match these filters"
                : "No batches recorded"
            }
            description={
              table.hasActiveFilters
                ? "Try a different search term or clear the filters."
                : "Receive stock to create the first batch."
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




