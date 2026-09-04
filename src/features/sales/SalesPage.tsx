"use client";

import { useRouter } from "next/navigation";
import { Eye, Receipt, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";

import { DateRangeFilter } from "@/components/shared/DateRangeFilter";
import { FilterBar, FilterSelect } from "@/components/shared/FilterBar";
import {
  PaymentMethodBadge,
  SaleStatusBadge,
} from "@/components/shared/StatusBadges";
import { Button } from "@/components/ui/Button";
import {
  DataTable,
  NumericCell,
  type Column,
} from "@/components/ui/DataTable";
import { RowActions } from "@/components/ui/DropdownMenu";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/States";
import { useTableState } from "@/hooks/useTableState";
import { useAuth, useCan } from "@/lib/auth/AuthProvider";
import { formatDate, formatTime, resolveDateRange, timestampToDateOnly, type DateRangePreset } from "@/lib/date";
import { formatMoney, formatQuantity } from "@/lib/money";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  SALE_STATUS_LABELS,
} from "@/lib/status";
import type { DateRange } from "@/types/common";
import type { PaymentMethod, Sale, SaleStatus } from "@/types/domain";
import { useCashiers, useSales } from "./hooks";

interface SalesTableFilters {
  from?: string;
  to?: string;
  cashierId?: string;
  paymentMethod?: PaymentMethod;
  status?: SaleStatus;
}

export function SalesPage() {
  const router = useRouter();
  const { user, can } = useAuth();
  const canRefund = useCan("sales:refund");
  const seesAllCashiers = can("sales:read:all");

  const [preset, setPreset] = useState<DateRangePreset>("today");
  const [range, setRange] = useState<DateRange>(() => resolveDateRange("today"));

  const table = useTableState<SalesTableFilters>({
    initialSort: { by: "createdAt", dir: "desc" },
    initialFilters: {},
  });

  const list = useSales({
    ...table.queryParams,
    from: range.from,
    to: range.to,
  });

  const cashiers = useCashiers();

  const columns = useMemo<Column<Sale>[]>(
    () => [
      {
        id: "receiptNumber",
        header: "Receipt",
        sortable: true,
        width: "132px",
        cell: (sale) => (
          <span className="num font-medium text-neutral-900">
            {sale.receiptNumber}
          </span>
        ),
      },
      {
        id: "createdAt",
        header: "Date / time",
        sortable: true,
        width: "150px",
        cell: (sale) => (
          <div className="flex flex-col whitespace-nowrap">
            <span className="num">
              {formatDate(timestampToDateOnly(sale.createdAt))}
            </span>
            <span className="num text-meta text-neutral-500">
              {formatTime(sale.createdAt)}
            </span>
          </div>
        ),
      },
      {
        id: "cashier",
        header: "Cashier",
        sortable: true,
        cell: (sale) => (
          <div className="flex min-w-0 flex-col">
            <span className="truncate">{sale.cashierName}</span>
            <span className="num truncate text-meta text-neutral-500">
              {sale.terminalName}
            </span>
          </div>
        ),
      },
      {
        id: "items",
        hideBelow: "xl",
        header: "Items",
        align: "right",
        width: "88px",
        cell: (sale) => (
          <NumericCell muted>
            {formatQuantity(
              sale.items.reduce((total, item) => total + item.quantity, 0),
            )}
          </NumericCell>
        ),
      },
      {
        id: "paymentMethod",
        header: "Payment",
        width: "116px",
        cell: (sale) => <PaymentMethodBadge method={sale.paymentMethod} size="sm" />,
      },
      {
        id: "total",
        header: "Total",
        align: "right",
        sortable: true,
        width: "128px",
        cell: (sale) => (
          <NumericCell className="font-semibold">
            {formatMoney(sale.total)}
          </NumericCell>
        ),
      },
      {
        id: "status",
        header: "Status",
        width: "150px",
        cell: (sale) => <SaleStatusBadge status={sale.status} size="sm" />,
      },
      {
        id: "actions",
        header: <span className="sr-only">Actions</span>,
        align: "right",
        width: "48px",
        cell: (sale) => (
          <RowActions
            label={`Actions for receipt ${sale.receiptNumber}`}
            actions={[
              {
                id: "view",
                label: "View sale",
                icon: <Eye className="size-4" />,
                onSelect: () => router.push(`/sales/${sale.id}`),
              },
              // Deliberately no delete: a sale is reversed, never removed.
              ...(canRefund && sale.status !== "REVERSED"
                ? [
                    {
                      id: "return",
                      label: "Return items",
                      icon: <RotateCcw className="size-4" />,
                      separated: true,
                      onSelect: () =>
                        router.push(`/returns?receipt=${sale.receiptNumber}`),
                    },
                  ]
                : []),
            ]}
          />
        ),
      },
    ],
    [router, canRefund],
  );

  const summary = useMemo(() => {
    const rows = list.data?.data ?? [];
    return {
      count: rows.length,
      value: rows.reduce((total, sale) => total + sale.total, 0),
    };
  }, [list.data]);

  return (
    <PageContainer>
      <PageHeader
        title="Sales"
        titleHidden
        description={
          seesAllCashiers
            ? "Completed transactions across every terminal."
            : "Your completed transactions."
        }
      />

      <FilterBar
        search={table.search}
        onSearchChange={table.setSearch}
        searchPlaceholder="Search receipt, cashier or product"
        hasActiveFilters={table.hasActiveFilters}
        onReset={table.reset}
        trailing={
          summary.count > 0 ? (
            <span className="text-meta text-neutral-500">
              This page:{" "}
              <span className="num font-semibold text-neutral-800">
                {formatMoney(summary.value)}
              </span>
            </span>
          ) : undefined
        }
      >
        <DateRangeFilter
          preset={preset}
          range={range}
          onChange={(nextPreset, nextRange) => {
            setPreset(nextPreset);
            setRange(nextRange);
            table.setPage(1);
          }}
        />

        {seesAllCashiers && (
          <FilterSelect
            label="Cashier"
            allLabel="All cashiers"
            value={table.filters.cashierId}
            onChange={(value) => table.setFilter("cashierId", value)}
            options={
              cashiers.data?.data.map((cashier) => ({
                value: cashier.id,
                label: cashier.name,
              })) ?? []
            }
          />
        )}

        <FilterSelect
          label="Payment method"
          allLabel="Any payment"
          value={table.filters.paymentMethod}
          onChange={(value) => table.setFilter("paymentMethod", value)}
          options={PAYMENT_METHODS.map((method) => ({
            value: method,
            label: PAYMENT_METHOD_LABELS[method],
          }))}
        />

        <FilterSelect
          label="Status"
          allLabel="Any status"
          value={table.filters.status}
          onChange={(value) => table.setFilter("status", value)}
          options={(
            ["COMPLETED", "PARTIALLY_RETURNED", "REVERSED"] as SaleStatus[]
          ).map((status) => ({
            value: status,
            label: SALE_STATUS_LABELS[status],
          }))}
        />
      </FilterBar>

      <DataTable
        caption="Completed sales"
        columns={columns}
        rows={list.data?.data ?? []}
        getRowId={(sale) => sale.id}
        isLoading={list.isPending}
        isError={list.isError}
        onRetry={() => void list.refetch()}
        sort={table.sort}
        onSortChange={table.setSort}
        onRowClick={(sale) => router.push(`/sales/${sale.id}`)}
        density="compact"
        className={
          list.isPlaceholderData ? "opacity-60 transition-opacity" : undefined
        }
        empty={
          <EmptyState
            icon={<Receipt className="size-5" />}
            title="No sales in this period"
            description={
              user && !seesAllCashiers
                ? "Sales you complete at the till will appear here."
                : "Try a wider date range, or clear the filters."
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

