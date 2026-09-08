"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, Pencil, Pill, Plus } from "lucide-react";
import { useMemo } from "react";

import { FilterBar, FilterSelect } from "@/components/shared/FilterBar";
import { StockStatusBadge } from "@/components/shared/StatusBadges";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  DataTable,
  EmptyCell,
  NumericCell,
  PrimaryCell,
  type Column,
} from "@/components/ui/DataTable";
import { RowActions } from "@/components/ui/DropdownMenu";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/States";
import { useTableState } from "@/hooks/useTableState";
import { useCan } from "@/lib/auth/AuthProvider";
import { formatMoney, formatQuantity } from "@/lib/money";
import {
  DOSAGE_FORM_LABELS,
  STOCK_STATUS_LABELS,
  UNIT_TYPE_LABELS,
} from "@/lib/status";
import type { ProductListItem } from "@/services/products.service";
import type { StockStatus } from "@/types/domain";
import { useCategories, useProducts } from "./hooks";

interface ProductTableFilters {
  categoryId?: string;
  stockStatus?: StockStatus;
}

export function ProductsPage() {
  const router = useRouter();
  const canWrite = useCan("products:write");

  const table = useTableState<ProductTableFilters>({
    initialSort: { by: "name", dir: "asc" },
    initialFilters: {},
  });

  const { data, isPending, isError, refetch, isPlaceholderData } = useProducts(
    table.queryParams,
  );
  const { data: categories } = useCategories();

  const columns = useMemo<Column<ProductListItem>[]>(
    () => [
      {
        // The specification lists product, generic and brand as separate
        // columns. Eleven columns do not fit 1366px, and the identifying
        // trio belongs together anyway — so generic and brand ride along
        // as the secondary line rather than costing two columns.
        id: "name",
        header: "Product",
        sortable: true,
        cell: (product) => (
          <PrimaryCell
            title={product.name}
            subtitle={
              [product.genericName, product.brandName]
                .filter(Boolean)
                .join(" · ") || undefined
            }
          />
        ),
      },
      {
        id: "category",
        header: "Category",
        sortable: true,
        cell: (product) => product.category?.name ?? <EmptyCell />,
      },
      {
        id: "form",
        hideBelow: "xl",
        header: "Form",
        width: "150px",
        cell: (product) => (
          <span className="whitespace-nowrap">
            {product.strength ? `${product.strength} · ` : ""}
            {product.dosageForm
              ? DOSAGE_FORM_LABELS[product.dosageForm]
              : UNIT_TYPE_LABELS[product.unitType]}
          </span>
        ),
      },
      {
        id: "barcode",
        hideBelow: "xl",
        header: "Barcode",
        width: "140px",
        cell: (product) =>
          product.barcode ? (
            <span className="num font-mono text-sm text-neutral-600">
              {product.barcode}
            </span>
          ) : (
            <EmptyCell />
          ),
      },
      {
        id: "sellingPrice",
        header: "Price",
        align: "right",
        sortable: true,
        width: "116px",
        cell: (product) => (
          <NumericCell>{formatMoney(product.priceConsumer)}</NumericCell>
        ),
      },
      {
        id: "availableStock",
        header: "Stock",
        align: "right",
        sortable: true,
        width: "104px",
        cell: (product) => (
          <NumericCell muted={product.availableStock === 0}>
            {formatQuantity(product.availableStock)}
            <span className="text-neutral-400">
              {" / "}
              {formatQuantity(product.minimumStockLevel)}
            </span>
          </NumericCell>
        ),
      },
      {
        id: "stockStatus",
        header: "Status",
        width: "140px",
        cell: (product) =>
          product.isActive ? (
            <StockStatusBadge status={product.stockStatus} size="sm" />
          ) : (
            <Badge tone="neutral" size="sm">
              Inactive
            </Badge>
          ),
      },
      {
        id: "actions",
        header: <span className="sr-only">Actions</span>,
        align: "right",
        width: "48px",
        cell: (product) => (
          <RowActions
            label={`Actions for ${product.name}`}
            actions={[
              {
                id: "view",
                label: "View details",
                icon: <Eye className="size-4" />,
                onSelect: () => router.push(`/products/${product.id}`),
              },
              ...(canWrite
                ? [
                    {
                      id: "edit",
                      label: "Edit product",
                      icon: <Pencil className="size-4" />,
                      onSelect: () =>
                        router.push(`/products/${product.id}/edit`),
                    },
                  ]
                : []),
            ]}
          />
        ),
      },
    ],
    [router, canWrite],
  );

  return (
    <PageContainer>
      <PageHeader
        title="Products"
        titleHidden
        description="The medicine catalogue. Stock quantities come from batches."
        actions={
          canWrite && (
            <Button asChild variant="primary" leadingIcon={<Plus className="size-4" />}>
              <Link href="/products/new">New product</Link>
            </Button>
          )
        }
      />

      <FilterBar
        search={table.search}
        onSearchChange={table.setSearch}
        searchPlaceholder="Search name, generic, brand or barcode"
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
      </FilterBar>

      <DataTable
        caption="Products in the catalogue"
        columns={columns}
        rows={data?.data ?? []}
        getRowId={(product) => product.id}
        isLoading={isPending}
        isError={isError}
        onRetry={() => void refetch()}
        sort={table.sort}
        onSortChange={table.setSort}
        onRowClick={(product) => router.push(`/products/${product.id}`)}
        rowClassName={(product) => (product.isActive ? undefined : "opacity-60")}
        className={isPlaceholderData ? "opacity-60 transition-opacity" : undefined}
        empty={
          <EmptyState
            icon={<Pill className="size-5" />}
            title={
              table.hasActiveFilters
                ? "No products match these filters"
                : "No products yet"
            }
            description={
              table.hasActiveFilters
                ? "Try a different search term or clear the filters."
                : "Add the first medicine to the catalogue to begin."
            }
            action={
              table.hasActiveFilters ? (
                <Button variant="secondary" onClick={table.reset}>
                  Clear filters
                </Button>
              ) : canWrite ? (
                <Button asChild variant="primary">
                  <Link href="/products/new">New product</Link>
                </Button>
              ) : undefined
            }
          />
        }
      />

      {data && data.total > 0 && (
        <Pagination
          page={data.page}
          pageSize={data.pageSize}
          total={data.total}
          totalPages={data.totalPages}
          onPageChange={table.setPage}
          onPageSizeChange={table.setPageSize}
        />
      )}
    </PageContainer>
  );
}




