"use client";

import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { Receipt } from "lucide-react";
import { useMemo, useState } from "react";

import { DateRangeFilter } from "@/components/shared/DateRangeFilter";
import { FilterSelect } from "@/components/shared/FilterBar";
import {
  PaymentMethodBadge,
  SaleStatusBadge,
} from "@/components/shared/StatusBadges";
import { Card, CardHeader } from "@/components/ui/Card";
import {
  DataTable,
  NumericCell,
  type Column,
} from "@/components/ui/DataTable";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  formatDate,
  formatTime,
  resolveDateRange,
  timestampToDateOnly,
  type DateRangePreset,
} from "@/lib/date";
import { formatMoney, formatMoneyCompact, formatQuantity } from "@/lib/money";
import { reportKeys } from "@/lib/query/keys";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS } from "@/lib/status";
import { reportsService } from "@/services/reports.service";
import { useCashiers, useSales } from "@/features/sales/hooks";
import type { DateRange } from "@/types/common";
import type { PaymentMethod, Sale } from "@/types/domain";
import { ReportShell, ReportSummary } from "./components/ReportShell";

const SalesTrendChart = dynamic(
  () =>
    import("@/features/dashboard/components/SalesTrendChart").then(
      (m) => m.SalesTrendChart,
    ),
  { ssr: false, loading: () => <Skeleton className="m-4 h-48" /> },
);

export function SalesReportPage() {
  const { can } = useAuth();
  const [preset, setPreset] = useState<DateRangePreset>("this-month");
  const [range, setRange] = useState<DateRange>(() =>
    resolveDateRange("this-month"),
  );
  const [cashierId, setCashierId] = useState<string | undefined>();
  const [paymentMethod, setPaymentMethod] = useState<
    PaymentMethod | undefined
  >();

  const filters = { ...range, cashierId, paymentMethod };

  const summary = useQuery({
    queryKey: reportKeys.sales(filters),
    queryFn: () => reportsService.salesSummary(filters),
  });

  const trend = useQuery({
    queryKey: [...reportKeys.sales(filters), "trend"],
    queryFn: () => reportsService.salesTrend(filters),
  });

  const sales = useSales({
    from: range.from,
    to: range.to,
    cashierId,
    paymentMethod,
    pageSize: 100,
    sortBy: "createdAt",
    sortDir: "desc",
  });

  const cashiers = useCashiers();

  const columns = useMemo<Column<Sale>[]>(
    () => [
      {
        id: "receiptNumber",
        header: "Receipt",
        width: "15%",
        cell: (sale) => (
          <span className="num font-medium text-neutral-900">
            {sale.receiptNumber}
          </span>
        ),
      },
      {
        id: "createdAt",
        header: "Date / time",
        width: "18%",
        cell: (sale) => (
          <span className="num whitespace-nowrap text-neutral-600">
            {formatDate(timestampToDateOnly(sale.createdAt))} ·{" "}
            {formatTime(sale.createdAt)}
          </span>
        ),
      },
      {
        id: "cashier",
        header: "Cashier",
        width: "18%",
        cell: (sale) => <span className="truncate">{sale.cashierName}</span>,
      },
      {
        id: "items",
        header: "Items",
        align: "right",
        width: "9%",
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
        width: "13%",
        cell: (sale) => (
          <PaymentMethodBadge method={sale.paymentMethod} size="sm" />
        ),
      },
      {
        id: "status",
        header: "Status",
        width: "14%",
        cell: (sale) => <SaleStatusBadge status={sale.status} size="sm" />,
      },
      {
        id: "total",
        header: "Total",
        align: "right",
        width: "13%",
        cell: (sale) => (
          <NumericCell className="font-semibold">
            {formatMoney(sale.total)}
          </NumericCell>
        ),
      },
    ],
    [],
  );

  return (
    <ReportShell
      title="Sales report"
      description="Takings for the selected period, and how they were paid."
      range={range}
      filters={
        <div className="flex flex-wrap items-center gap-2">
          <DateRangeFilter
            preset={preset}
            range={range}
            onChange={(nextPreset, nextRange) => {
              setPreset(nextPreset);
              setRange(nextRange);
            }}
          />
          {can("sales:read:all") && (
            <FilterSelect
              label="Cashier"
              allLabel="All cashiers"
              value={cashierId}
              onChange={setCashierId}
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
            value={paymentMethod}
            onChange={setPaymentMethod}
            options={PAYMENT_METHODS.map((method) => ({
              value: method,
              label: PAYMENT_METHOD_LABELS[method],
            }))}
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
              {
                label: "Gross sales",
                value: formatMoney(summary.data?.grossSales ?? 0),
              },
              {
                label: "Transactions",
                value: formatQuantity(summary.data?.transactionCount ?? 0),
              },
              {
                label: "Average sale",
                value: formatMoney(summary.data?.averageSale ?? 0),
              },
              ...(summary.data?.byMethod ?? []).map((entry) => ({
                label: PAYMENT_METHOD_LABELS[entry.method],
                value: formatMoneyCompact(entry.total),
                context: `${Math.round(entry.share * 100)}% · ${formatQuantity(entry.transactions)} sales`,
              })),
            ]}
          />
        )
      }
    >
      {summary.data && summary.data.refundedAmount > 0 && (
        <p className="text-meta text-neutral-500">
          {formatQuantity(summary.data.refundCount)}{" "}
          {summary.data.refundCount === 1 ? "return was" : "returns were"}{" "}
          recorded in this period, refunding{" "}
          <span className="num font-semibold text-neutral-700">
            {formatMoney(summary.data.refundedAmount)}
          </span>
          . Fully reversed sales are excluded from gross sales above.
        </p>
      )}

      {/*
        A trend needs at least two points to be a trend. On a single-day
        range one bar restates the Gross Sales tile and earns no space, so
        the chart is omitted rather than drawn for decoration.
      */}
      {(trend.isPending || (trend.data?.length ?? 0) > 1) && (
        <Card>
          <CardHeader
            title="Daily takings"
            description={`${formatDate(range.from)} – ${formatDate(range.to)}`}
          />
          {trend.isPending ? (
            <Skeleton className="m-4 h-48" />
          ) : (
            <SalesTrendChart data={trend.data ?? []} />
          )}
        </Card>
      )}

      <DataTable
        caption="Sales in the selected period"
        columns={columns}
        rows={sales.data?.data ?? []}
        getRowId={(sale) => sale.id}
        isLoading={sales.isPending}
        isError={sales.isError}
        onRetry={() => void sales.refetch()}
        density="compact"
        empty={
          <EmptyState
            icon={<Receipt className="size-5" />}
            title="No sales in this period"
            description="Try a wider date range or clear the filters."
          />
        }
      />

      {(sales.data?.total ?? 0) > (sales.data?.data.length ?? 0) && (
        <p className="text-meta text-neutral-500">
          Showing the {formatQuantity(sales.data?.data.length ?? 0)} most recent
          of {formatQuantity(sales.data?.total ?? 0)} sales. The summary figures
          above cover the whole period.
        </p>
      )}
    </ReportShell>
  );
}
