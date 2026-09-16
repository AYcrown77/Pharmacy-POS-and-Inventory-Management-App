"use client";

import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Receipt } from "lucide-react";
import { useMemo, useState } from "react";

import { DateRangeFilter } from "@/components/shared/DateRangeFilter";
import { FilterSelect } from "@/components/shared/FilterBar";
import {
  PaymentMethodBadge,
  SaleStatusBadge,
} from "@/components/shared/StatusBadges";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import {
  DataTable,
  NumericCell,
  type Column,
} from "@/components/ui/DataTable";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useAuth } from "@/lib/auth/AuthProvider";
import { cn } from "@/lib/cn";
import {
  formatDate,
  formatTime,
  resolveDateRange,
  timestampToDateOnly,
  type DateRangePreset,
} from "@/lib/date";
import { formatMoney, formatMoneyCompact, formatQuantity } from "@/lib/money";
import { reportKeys } from "@/lib/query/keys";
import {
  EXPENSE_CATEGORY_LABELS,
  PAYMENT_METHOD_LABELS,
  SALE_PAYMENT_METHOD_LABELS,
  SALE_PAYMENT_METHODS,
} from "@/lib/status";
import { reportsService } from "@/services/reports.service";
import { useCashiers, useSales } from "@/features/sales/hooks";
import type { DateRange } from "@/types/common";
import type { SalesReportSummary } from "@/types/analytics";
import type { Sale, SalePaymentMethod } from "@/types/domain";
import { csvDateTime, csvMoney, csvNumber, exportCsv } from "@/lib/csv";
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
    SalePaymentMethod | undefined
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
      onExport={() =>
        exportCsv(
          "sales report",
          [
            { header: "Receipt", value: (s) => s.receiptNumber },
            { header: "Date", value: (s) => csvDateTime(s.createdAt) },
            { header: "Cashier", value: (s) => s.cashierName },
            { header: "Terminal", value: (s) => s.terminalName },
            { header: "Items", value: (s) => csvNumber(s.items.length) },
            { header: "Payment", value: (s) => s.paymentMethod },
            { header: "Status", value: (s) => s.status },
            { header: "Subtotal", value: (s) => csvMoney(s.subtotal) },
            { header: "Discount", value: (s) => csvMoney(s.discount) },
            { header: "Total", value: (s) => csvMoney(s.total) },
          ],
          sales.data?.data ?? [],
          range,
        )
      }
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
            options={SALE_PAYMENT_METHODS.map((method) => ({
              value: method,
              label: SALE_PAYMENT_METHOD_LABELS[method],
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
      {summary.data && <Reconciliation summary={summary.data} />}

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

/**
 * The day-end sum: what was sold, less what went back out.
 *
 * Refunds and expenses are money out of the business in the period, so they
 * come off. Credit sales and debt collected are shown beside the sum rather
 * than in it: neither changes what was earned, only when the money arrives.
 */
function Reconciliation({ summary }: { summary: SalesReportSummary }) {
  return (
    <Card>
      <CardHeader
        title="Takings after expenses"
        description="Gross sales, less refunds and the expenses recorded for the same days."
      />
      <CardBody className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <dl className="flex flex-col gap-2">
            <Sum label="Gross sales" value={summary.grossSales} strong />
            <Sum label="Refunds" value={-summary.refundedAmount} />
            <Sum
              label={`Expenses (${formatQuantity(summary.expenses.count)})`}
              value={-summary.expenses.total}
            />
            <div className="flex items-baseline justify-between gap-3 border-t border-neutral-200 pt-2">
              <dt className="text-base font-semibold text-neutral-900">
                Net takings
              </dt>
              <dd
                className={cn(
                  "num text-title font-bold tabular-nums",
                  summary.netSales < 0 ? "text-danger-700" : "text-neutral-900",
                )}
              >
                {formatMoney(summary.netSales)}
              </dd>
            </div>
          </dl>
          <p className="text-meta text-neutral-500">
            Of gross sales,{" "}
            <span className="num font-medium text-neutral-700">
              {formatMoney(summary.creditSales)}
            </span>{" "}
            was taken on account and is not yet paid.{" "}
            <span className="num font-medium text-neutral-700">
              {formatMoney(summary.debtCollected)}
            </span>{" "}
            came in against older debts — money in the drawer, but not a sale.
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-micro font-semibold uppercase tracking-wide text-neutral-500">
              Expenses by category
            </p>
            <Link
              href="/expenses"
              className="text-meta font-medium text-primary-700 hover:underline"
            >
              View expenses
            </Link>
          </div>
          {summary.expenses.byCategory.length === 0 ? (
            <p className="mt-2 text-meta text-neutral-500">
              No expenses recorded in this period.
            </p>
          ) : (
            <ul className="mt-1 flex flex-col divide-y divide-neutral-100">
              {summary.expenses.byCategory.map((entry) => (
                <li
                  key={entry.category}
                  className="flex items-baseline justify-between gap-3 py-1.5"
                >
                  <span className="text-base text-neutral-700">
                    {EXPENSE_CATEGORY_LABELS[entry.category]}{" "}
                    <span className="text-meta text-neutral-400">
                      · {formatQuantity(entry.count)}
                    </span>
                  </span>
                  <span className="num text-base tabular-nums text-neutral-900">
                    {formatMoney(entry.total)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

function Sum({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-base text-neutral-600">{label}</dt>
      <dd
        className={cn(
          "num text-base tabular-nums",
          strong ? "font-semibold text-neutral-900" : "text-neutral-700",
        )}
      >
        {value < 0 ? `− ${formatMoney(-value)}` : formatMoney(value)}
      </dd>
    </div>
  );
}
