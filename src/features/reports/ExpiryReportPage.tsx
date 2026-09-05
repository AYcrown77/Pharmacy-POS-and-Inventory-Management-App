"use client";

import { useQuery } from "@tanstack/react-query";
import { CalendarClock } from "lucide-react";
import { useMemo, useState } from "react";

import { FilterSelect } from "@/components/shared/FilterBar";
import { ExpiryStatusBadge } from "@/components/shared/StatusBadges";
import {
  DataTable,
  NumericCell,
  PrimaryCell,
  type Column,
} from "@/components/ui/DataTable";
import { SearchInput } from "@/components/ui/Input";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useDebounce } from "@/hooks/useDebounce";
import { cn } from "@/lib/cn";
import { formatDate, formatExpiryRelative } from "@/lib/date";
import { formatMoney, formatMoneyCompact, formatQuantity } from "@/lib/money";
import { batchKeys } from "@/lib/query/keys";
import {
  EXPIRY_STATUS_ORDER,
  EXPIRY_STATUS_RANGE_LABELS,
} from "@/lib/status";
import { inventoryService } from "@/services/inventory.service";
import { useCategories } from "@/features/products/hooks";
import type { ExpiryAlertItem } from "@/types/analytics";
import type { ExpiryStatus } from "@/types/domain";
import { ReportShell, ReportSummary } from "./components/ReportShell";

export function ExpiryReportPage() {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [expiryStatus, setExpiryStatus] = useState<ExpiryStatus | undefined>();

  const debounced = useDebounce(search);
  const filters = {
    search: debounced.trim() || undefined,
    categoryId,
    expiryStatus,
    onlyInStock: true,
    pageSize: 200,
    sortBy: "daysUntilExpiry",
    sortDir: "asc" as const,
  };

  const list = useQuery({
    queryKey: batchKeys.expiry(filters),
    queryFn: () => inventoryService.listExpiring(filters),
  });

  const summary = useQuery({
    queryKey: batchKeys.expirySummary(),
    queryFn: () => inventoryService.getExpirySummary(),
  });

  const { data: categories } = useCategories();

  /** Value at risk on the rows currently shown. */
  const atRisk = useMemo(
    () =>
      (list.data?.data ?? [])
        .filter((item) => item.daysUntilExpiry <= 90)
        .reduce((total, item) => total + item.stockValue, 0),
    [list.data],
  );

  const columns = useMemo<Column<ExpiryAlertItem>[]>(
    () => [
      {
        id: "product",
        header: "Medicine",
        width: "28%",
        cell: (item) => (
          <PrimaryCell title={item.productName} subtitle={item.batchNumber} />
        ),
      },
      {
        id: "quantity",
        header: "Remaining",
        align: "right",
        width: "12%",
        cell: (item) => (
          <NumericCell>{formatQuantity(item.quantityRemaining)}</NumericCell>
        ),
      },
      {
        id: "expiryDate",
        header: "Expiry date",
        width: "15%",
        cell: (item) => (
          <span className="num whitespace-nowrap">
            {formatDate(item.expiryDate)}
          </span>
        ),
      },
      {
        id: "daysUntilExpiry",
        header: "Days until expiry",
        align: "right",
        width: "16%",
        cell: (item) => (
          <span
            className={cn(
              "num whitespace-nowrap",
              item.daysUntilExpiry < 0
                ? "font-medium text-danger-700"
                : item.daysUntilExpiry <= 30
                  ? "font-medium text-danger-600"
                  : "text-neutral-600",
            )}
          >
            {formatExpiryRelative(item.expiryDate)}
          </span>
        ),
      },
      {
        id: "status",
        header: "Status",
        width: "14%",
        cell: (item) => (
          <ExpiryStatusBadge status={item.expiryStatus} size="sm" />
        ),
      },
      {
        id: "stockValue",
        header: "Stock value",
        align: "right",
        width: "14%",
        cell: (item) => (
          <NumericCell
            className={cn(
              "font-semibold",
              item.daysUntilExpiry < 0 && "text-danger-700",
            )}
          >
            {formatMoney(item.stockValue)}
          </NumericCell>
        ),
      },
    ],
    [],
  );

  return (
    <ReportShell
      title="Expiry report"
      description="Batches by remaining shelf life, soonest first."
      filters={
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-full min-w-48 sm:w-64">
            <SearchInput
              inputSize="sm"
              value={search}
              placeholder="Search product, batch or supplier"
              aria-label="Search batches"
              onChange={(event) => setSearch(event.target.value)}
              onClear={() => setSearch("")}
            />
          </div>
          <FilterSelect
            label="Expiry band"
            allLabel="All bands"
            value={expiryStatus}
            onChange={setExpiryStatus}
            options={EXPIRY_STATUS_ORDER.map((status) => ({
              value: status,
              label: EXPIRY_STATUS_RANGE_LABELS[status],
            }))}
          />
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
        </div>
      }
      summary={
        summary.isError ? (
          <ErrorState onRetry={() => void summary.refetch()} className="py-8" />
        ) : (
          <ReportSummary
            columns={6}
            isPending={summary.isPending}
            items={[
              ...EXPIRY_STATUS_ORDER.map((status) => ({
                label: EXPIRY_STATUS_RANGE_LABELS[status],
                value: formatQuantity(summary.data?.[status] ?? 0),
                tone:
                  status === "EXPIRED" || status === "CRITICAL_30"
                    ? ("danger" as const)
                    : status === "HEALTHY"
                      ? undefined
                      : ("warning" as const),
                accent: (summary.data?.[status] ?? 0) > 0,
                // Each band is also the filter for that band. Pressing the
                // selected one again clears it, so the tiles are the whole
                // control rather than something to undo in the dropdown.
                selected: expiryStatus === status,
                onSelect: () =>
                  setExpiryStatus((current) =>
                    current === status ? undefined : status,
                  ),
              })),
              {
                label: "Value at risk",
                value: formatMoneyCompact(atRisk),
                context: "Within 90 days",
              },
            ]}
          />
        )
      }
    >
      <DataTable
        caption="Batches by expiry"
        columns={columns}
        rows={list.data?.data ?? []}
        getRowId={(item) => item.batchId}
        isLoading={list.isPending}
        isError={list.isError}
        onRetry={() => void list.refetch()}
        density="compact"
        rowClassName={(item) =>
          item.daysUntilExpiry < 0 ? "bg-danger-50/50" : undefined
        }
        empty={
          <EmptyState
            icon={<CalendarClock className="size-5" />}
            title="No batches match these filters"
          />
        }
      />
    </ReportShell>
  );
}
