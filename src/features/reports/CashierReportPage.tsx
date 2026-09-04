"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Eye, Users } from "lucide-react";
import { useMemo, useState } from "react";

import { DateRangeFilter } from "@/components/shared/DateRangeFilter";
import {
  DataTable,
  NumericCell,
  PrimaryCell,
  type Column,
} from "@/components/ui/DataTable";
import { RowActions } from "@/components/ui/DropdownMenu";
import { EmptyState } from "@/components/ui/States";
import { formatDate, resolveDateRange, type DateRangePreset } from "@/lib/date";
import { formatMoney, formatQuantity } from "@/lib/money";
import { reportKeys } from "@/lib/query/keys";
import { reportsService } from "@/services/reports.service";
import type { CashierReportRow } from "@/types/analytics";
import type { DateRange } from "@/types/common";
import { ReportShell, ReportSummary } from "./components/ReportShell";

/**
 * Takings per cashier, for end-of-shift reconciliation. The cash column is
 * the one that gets counted against the drawer, so it leads the breakdown.
 */
export function CashierReportPage() {
  const router = useRouter();
  const [preset, setPreset] = useState<DateRangePreset>("today");
  const [range, setRange] = useState<DateRange>(() => resolveDateRange("today"));

  const report = useQuery({
    queryKey: reportKeys.cashiers(range),
    queryFn: () => reportsService.cashierReport(range),
  });

  const totals = useMemo(() => {
    const rows = report.data ?? [];
    return {
      cashiers: rows.length,
      transactions: rows.reduce((total, row) => total + row.transactions, 0),
      cash: rows.reduce((total, row) => total + row.cashSales, 0),
      card: rows.reduce((total, row) => total + row.cardSales, 0),
      transfer: rows.reduce((total, row) => total + row.transferSales, 0),
      total: rows.reduce((total, row) => total + row.totalSales, 0),
    };
  }, [report.data]);

  const columns = useMemo<Column<CashierReportRow>[]>(
    () => [
      {
        id: "cashierName",
        header: "Cashier",
        width: "22%",
        cell: (row) => (
          <PrimaryCell
            title={row.cashierName}
            subtitle={`${formatMoney(row.averageSale)} average sale`}
          />
        ),
      },
      {
        id: "transactions",
        header: "Transactions",
        align: "right",
        width: "13%",
        cell: (row) => (
          <NumericCell>{formatQuantity(row.transactions)}</NumericCell>
        ),
      },
      {
        id: "cashSales",
        header: "Cash",
        align: "right",
        width: "14%",
        cell: (row) => (
          <NumericCell className="font-medium">
            {formatMoney(row.cashSales)}
          </NumericCell>
        ),
      },
      {
        id: "cardSales",
        header: "POS / Card",
        align: "right",
        width: "14%",
        cell: (row) => (
          <NumericCell muted>{formatMoney(row.cardSales)}</NumericCell>
        ),
      },
      {
        id: "transferSales",
        header: "Transfer",
        align: "right",
        width: "14%",
        cell: (row) => (
          <NumericCell muted>{formatMoney(row.transferSales)}</NumericCell>
        ),
      },
      {
        id: "totalSales",
        header: "Total",
        align: "right",
        width: "15%",
        cell: (row) => (
          <NumericCell className="font-semibold">
            {formatMoney(row.totalSales)}
          </NumericCell>
        ),
      },
      {
        id: "actions",
        header: <span className="sr-only">Actions</span>,
        align: "right",
        width: "48px",
        cell: (row) => (
          <RowActions
            label={`Actions for ${row.cashierName}`}
            actions={[
              {
                id: "sales",
                label: "View their sales",
                icon: <Eye className="size-4" />,
                onSelect: () => router.push("/sales"),
              },
            ]}
          />
        ),
      },
    ],
    [router],
  );

  return (
    <ReportShell
      title="Cashier report"
      description="Takings per cashier, split by payment method."
      range={range}
      filters={
        <DateRangeFilter
          preset={preset}
          range={range}
          onChange={(nextPreset, nextRange) => {
            setPreset(nextPreset);
            setRange(nextRange);
          }}
        />
      }
      summary={
        <ReportSummary
          columns={5}
          isPending={report.isPending}
          items={[
            {
              label: "Cashiers",
              value: formatQuantity(totals.cashiers),
              context: `${formatDate(range.from)} – ${formatDate(range.to)}`,
            },
            {
              label: "Transactions",
              value: formatQuantity(totals.transactions),
            },
            { label: "Cash", value: formatMoney(totals.cash) },
            { label: "POS / Card", value: formatMoney(totals.card) },
            { label: "Transfer", value: formatMoney(totals.transfer) },
          ]}
        />
      }
    >
      <DataTable
        caption="Takings by cashier"
        columns={columns}
        rows={report.data ?? []}
        getRowId={(row) => row.cashierId}
        isLoading={report.isPending}
        isError={report.isError}
        onRetry={() => void report.refetch()}
        empty={
          <EmptyState
            icon={<Users className="size-5" />}
            title="No takings in this period"
            description="No cashier recorded a sale between these dates."
          />
        }
      />

      {(report.data?.length ?? 0) > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
          <span className="text-base font-medium text-neutral-700">
            All cashiers
          </span>
          <span className="num text-title font-bold tabular-nums text-neutral-900">
            {formatMoney(totals.total)}
          </span>
        </div>
      )}
    </ReportShell>
  );
}
