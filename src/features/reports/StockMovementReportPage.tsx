"use client";

import { useQuery } from "@tanstack/react-query";
import { ClipboardList } from "lucide-react";
import { useMemo, useState } from "react";

import { DateRangeFilter } from "@/components/shared/DateRangeFilter";
import { FilterSelect } from "@/components/shared/FilterBar";
import {
  MovementTypeBadge,
  QuantityDelta,
} from "@/components/shared/StatusBadges";
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
import {
  formatDate,
  formatTime,
  resolveDateRange,
  timestampToDateOnly,
  type DateRangePreset,
} from "@/lib/date";
import { formatQuantity } from "@/lib/money";
import { movementKeys, reportKeys } from "@/lib/query/keys";
import { MOVEMENT_TYPE_LABELS } from "@/lib/status";
import { inventoryService } from "@/services/inventory.service";
import { reportsService } from "@/services/reports.service";
import type { DateRange } from "@/types/common";
import type { MovementType, StockMovement } from "@/types/domain";
import { csvDateTime, csvNumber, exportCsv } from "@/lib/csv";
import { ReportShell, ReportSummary } from "./components/ReportShell";

const MOVEMENT_TYPES: MovementType[] = [
  "STOCK_RECEIVED",
  "SALE",
  "RETURN",
  "ADJUSTMENT",
  "DAMAGE",
  "EXPIRY",
];

export function StockMovementReportPage() {
  const [preset, setPreset] = useState<DateRangePreset>("this-month");
  const [range, setRange] = useState<DateRange>(() =>
    resolveDateRange("this-month"),
  );
  const [movementType, setMovementType] = useState<MovementType | undefined>();
  const [search, setSearch] = useState("");

  const debounced = useDebounce(search);

  const listFilters = {
    from: range.from,
    to: range.to,
    movementType,
    search: debounced.trim() || undefined,
    pageSize: 200,
  };

  const list = useQuery({
    queryKey: movementKeys.list(listFilters),
    queryFn: () => inventoryService.listMovements(listFilters),
  });

  const summaryFilters = { ...range, movementType };
  const summary = useQuery({
    queryKey: reportKeys.movements(summaryFilters),
    queryFn: () => reportsService.movementSummary(summaryFilters),
  });

  const columns = useMemo<Column<StockMovement>[]>(
    () => [
      {
        id: "createdAt",
        header: "Date",
        width: "132px",
        cell: (movement) => (
          <div className="flex flex-col whitespace-nowrap">
            <span className="num">
              {formatDate(timestampToDateOnly(movement.createdAt))}
            </span>
            <span className="num text-meta text-neutral-500">
              {formatTime(movement.createdAt)}
            </span>
          </div>
        ),
      },
      {
        id: "product",
        header: "Product",
        cell: (movement) => (
          <PrimaryCell
            title={movement.productName}
            subtitle={movement.batchNumber ?? undefined}
          />
        ),
      },
      {
        id: "movementType",
        header: "Type",
        width: "128px",
        cell: (movement) => (
          <MovementTypeBadge type={movement.movementType} size="sm" />
        ),
      },
      {
        id: "quantity",
        header: "Change",
        align: "right",
        width: "108px",
        cell: (movement) => (
          <QuantityDelta
            value={movement.quantity}
            // A sale is routine stock leaving, not a problem to flag red.
            tone={movement.movementType === "SALE" ? "neutral" : "auto"}
          />
        ),
      },
      {
        id: "previousQuantity",
        hideBelow: "xl",
        header: "Previous",
        align: "right",
        width: "96px",
        cell: (movement) => (
          <NumericCell muted>
            {formatQuantity(movement.previousQuantity)}
          </NumericCell>
        ),
      },
      {
        id: "newQuantity",
        header: "New",
        align: "right",
        width: "92px",
        cell: (movement) => (
          <NumericCell>{formatQuantity(movement.newQuantity)}</NumericCell>
        ),
      },
      {
        id: "userName",
        header: "User",
        width: "140px",
        cell: (movement) => (
          <span className="block truncate">{movement.userName}</span>
        ),
      },
      {
        id: "reason",
        hideBelow: "xl",
        header: "Reason",
        cell: (movement) => (
          <span className="block truncate" title={movement.reason ?? undefined}>
            {movement.reason ?? <EmptyCell />}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <ReportShell
      onExport={() =>
        exportCsv(
          "stock movements",
          [
            { header: "Date", value: (m) => csvDateTime(m.createdAt) },
            { header: "Product", value: (m) => m.productName },
            { header: "Batch", value: (m) => m.batchNumber },
            { header: "Type", value: (m) => m.movementType },
            { header: "Change", value: (m) => csvNumber(m.quantity) },
            { header: "Previous", value: (m) => csvNumber(m.previousQuantity) },
            { header: "New", value: (m) => csvNumber(m.newQuantity) },
            { header: "Reference", value: (m) => m.referenceType },
            { header: "User", value: (m) => m.userName },
            { header: "Reason", value: (m) => m.reason },
          ],
          list.data?.data ?? [],
          range,
        )
      }
      title="Stock movement report"
      description="Exactly how inventory entered and left the pharmacy."
      range={range}
      filters={
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-full min-w-48 sm:w-56">
            <SearchInput
              inputSize="sm"
              value={search}
              placeholder="Search product, batch or user"
              aria-label="Search movements"
              onChange={(event) => setSearch(event.target.value)}
              onClear={() => setSearch("")}
            />
          </div>
          <DateRangeFilter
            preset={preset}
            range={range}
            onChange={(nextPreset, nextRange) => {
              setPreset(nextPreset);
              setRange(nextRange);
            }}
          />
          <FilterSelect
            label="Movement type"
            allLabel="All movement types"
            value={movementType}
            onChange={setMovementType}
            options={MOVEMENT_TYPES.map((type) => ({
              value: type,
              label: MOVEMENT_TYPE_LABELS[type],
            }))}
          />
        </div>
      }
      summary={
        summary.isError ? (
          <ErrorState onRetry={() => void summary.refetch()} className="py-8" />
        ) : (
          <ReportSummary
            columns={4}
            isPending={summary.isPending}
            items={[
              {
                label: "Movements",
                value: formatQuantity(summary.data?.movementCount ?? 0),
              },
              {
                label: "Units in",
                value: `+${formatQuantity(summary.data?.unitsIn ?? 0)}`,
                context: "Received and returned",
              },
              {
                label: "Units out",
                value: `−${formatQuantity(summary.data?.unitsOut ?? 0)}`,
                context: "Sold, damaged, expired",
              },
              {
                label: "Net change",
                value: `${(summary.data?.netUnits ?? 0) >= 0 ? "+" : "−"}${formatQuantity(
                  Math.abs(summary.data?.netUnits ?? 0),
                )}`,
                context: "Across the period",
              },
            ]}
          />
        )
      }
    >
      <DataTable
        caption="Stock movement ledger"
        columns={columns}
        rows={list.data?.data ?? []}
        getRowId={(movement) => movement.id}
        isLoading={list.isPending}
        isError={list.isError}
        onRetry={() => void list.refetch()}
        density="compact"
        empty={
          <EmptyState
            icon={<ClipboardList className="size-5" />}
            title="No movements in this period"
            description="Try a wider date range or a different movement type."
          />
        }
      />

      {(list.data?.total ?? 0) > (list.data?.data.length ?? 0) && (
        <p className="text-meta text-neutral-500">
          Showing the {formatQuantity(list.data?.data.length ?? 0)} most recent
          of {formatQuantity(list.data?.total ?? 0)} movements. The summary
          figures above cover the whole period.
        </p>
      )}
    </ReportShell>
  );
}



