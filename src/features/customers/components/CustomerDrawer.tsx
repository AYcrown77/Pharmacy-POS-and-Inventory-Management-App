"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ScrollText, ShoppingBag } from "lucide-react";
import { useState } from "react";

import {
  PaymentMethodBadge,
  SaleStatusBadge,
} from "@/components/shared/StatusBadges";
import { Drawer } from "@/components/ui/Drawer";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { TabPanel, Tabs } from "@/components/ui/Tabs";
import { cn } from "@/lib/cn";
import {
  formatDateTime,
  formatMonthYear,
  formatRelativeTime,
} from "@/lib/date";
import { formatMoney, formatQuantity } from "@/lib/money";
import { SALE_PAYMENT_METHOD_LABELS } from "@/lib/status";
import { customersService } from "@/services/customers.service";
import type { CustomerInsights } from "@/types/analytics";
import type { Customer, LedgerEntryType } from "@/types/domain";

const ENTRY_LABELS: Record<LedgerEntryType, string> = {
  CHARGE: "Taken on account",
  REPAYMENT: "Payment received",
  REVERSAL: "Returned goods",
  ADJUSTMENT: "Adjustment",
};

/**
 * One customer: how they buy, and what they owe.
 *
 * Buying habits come first because that is the new question this drawer
 * answers — who the regulars are and what keeps them coming. The statement
 * sits one tab over and loads only when opened, since most visits here are
 * not about a balance.
 */
export function CustomerDrawer({
  customer,
  open,
  onOpenChange,
}: {
  customer: Customer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [tab, setTab] = useState("habits");

  const insights = useQuery({
    queryKey: ["customers", "insights", customer?.id],
    queryFn: () => customersService.getInsights(customer!.id),
    enabled: open && Boolean(customer),
  });

  const ledger = useQuery({
    queryKey: ["customers", "ledger", customer?.id],
    queryFn: () => customersService.getLedger(customer!.id, { pageSize: 100 }),
    enabled: open && Boolean(customer) && tab === "statement",
  });

  const balance =
    ledger.data?.customer.balance ??
    insights.data?.customer.balance ??
    customer?.balance ??
    0;

  const entries = ledger.data?.entries.data ?? [];

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={customer?.name ?? "Customer"}
      description={customer?.phone ?? undefined}
      width="lg"
    >
      <div className="flex flex-col gap-4">
        <div
          className={cn(
            "rounded-lg px-4 py-3 ring-1 ring-inset",
            balance > 0
              ? "bg-danger-50 ring-danger-200"
              : balance < 0
                ? "bg-success-50 ring-success-200"
                : "bg-neutral-50 ring-neutral-200",
          )}
        >
          <p className="text-micro font-semibold uppercase tracking-wide text-neutral-500">
            {balance < 0 ? "In credit" : "Balance owing"}
          </p>
          <p
            className={cn(
              "num text-stat font-semibold tabular-nums",
              balance > 0
                ? "text-danger-700"
                : balance < 0
                  ? "text-success-700"
                  : "text-neutral-500",
            )}
          >
            {formatMoney(Math.abs(balance))}
          </p>
        </div>

        <Tabs
          tabs={[
            { value: "habits", label: "Buying habits" },
            { value: "statement", label: "Statement" },
          ]}
          value={tab}
          onValueChange={setTab}
        >
          <TabPanel value="habits">
            {insights.isPending && <Skeleton className="h-64 w-full" />}
            {insights.isError && (
              <ErrorState onRetry={() => void insights.refetch()} />
            )}
            {insights.data && <Habits data={insights.data} />}
          </TabPanel>

          <TabPanel value="statement">
            {ledger.isPending && <Skeleton className="h-40 w-full" />}
            {ledger.isError && <ErrorState onRetry={() => void ledger.refetch()} />}
            {!ledger.isPending && !ledger.isError && entries.length === 0 && (
              <EmptyState
                icon={<ScrollText className="size-5" />}
                title="Nothing on this account yet"
              />
            )}

            <ul className="flex flex-col divide-y divide-neutral-200">
              {entries.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-start justify-between gap-3 py-2.5"
                >
                  <span className="min-w-0">
                    <span className="block text-base font-medium text-neutral-900">
                      {ENTRY_LABELS[entry.entryType]}
                    </span>
                    <span className="block text-meta text-neutral-500">
                      {formatDateTime(entry.createdAt)}
                      {entry.receiptNumber ? ` · ${entry.receiptNumber}` : ""}
                      {entry.userName ? ` · ${entry.userName}` : ""}
                    </span>
                    {entry.reason && (
                      <span className="block text-meta text-neutral-500">
                        {entry.reason}
                      </span>
                    )}
                  </span>

                  <span className="shrink-0 text-right">
                    <span
                      className={cn(
                        "num block font-semibold tabular-nums",
                        entry.amount > 0 ? "text-danger-700" : "text-success-700",
                      )}
                    >
                      {entry.amount > 0 ? "+" : "−"}
                      {formatMoney(Math.abs(entry.amount))}
                    </span>
                    <span className="num block text-meta text-neutral-500">
                      {formatMoney(entry.balanceAfter)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </TabPanel>
        </Tabs>
      </div>
    </Drawer>
  );
}

function Habits({ data }: { data: CustomerInsights }) {
  if (data.purchaseCount === 0) {
    return (
      <EmptyState
        icon={<ShoppingBag className="size-5" />}
        title="No purchases on this account yet"
        description="They appear here once a sale is rung up with this customer attached."
      />
    );
  }

  const busiestMonth = Math.max(...data.monthly.map((month) => month.total), 1);
  const gap = data.averageDaysBetweenPurchases;

  return (
    <div className="flex flex-col gap-5">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Figure label="Total spent" value={formatMoney(data.totalSpent)} />
        <Figure label="Purchases" value={formatQuantity(data.purchaseCount)} />
        <Figure label="Average purchase" value={formatMoney(data.averageBasket)} />
        <Figure
          label="Last purchase"
          value={
            data.lastPurchaseAt ? formatRelativeTime(data.lastPurchaseAt) : "—"
          }
        />
        <Figure
          label="Comes in"
          value={
            gap === null
              ? "Once so far"
              : gap <= 1
                ? "Almost daily"
                : `Every ${formatQuantity(gap)} days`
          }
        />
        <Figure
          label="Usually pays by"
          value={
            data.preferredPaymentMethod
              ? SALE_PAYMENT_METHOD_LABELS[data.preferredPaymentMethod]
              : "—"
          }
        />
      </dl>

      {data.takenOnAccount > 0 && (
        <p className="text-meta text-neutral-500">
          Has taken{" "}
          <span className="num font-semibold text-neutral-700">
            {formatMoney(data.takenOnAccount)}
          </span>{" "}
          of goods on account across these purchases.
        </p>
      )}

      <section>
        <SectionTitle>Last six months</SectionTitle>
        <ul className="mt-2 flex flex-col gap-1.5">
          {data.monthly.map((month) => (
            <li
              key={month.month}
              className="grid grid-cols-[5.5rem_minmax(0,1fr)_6.5rem] items-center gap-2 text-meta"
            >
              <span className="text-neutral-600">
                {formatMonthYear(`${month.month}-01`)}
              </span>
              <span className="h-2 overflow-hidden rounded-full bg-neutral-100">
                <span
                  className="block h-full rounded-full bg-primary-500"
                  style={{ width: `${(month.total / busiestMonth) * 100}%` }}
                />
              </span>
              <span className="num text-right tabular-nums text-neutral-700">
                {month.total > 0 ? formatMoney(month.total) : "—"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <SectionTitle>Buys most</SectionTitle>
        <ul className="mt-1 divide-y divide-neutral-100">
          {data.topProducts.map((product) => (
            <li
              key={product.productId}
              className="flex items-baseline justify-between gap-3 py-2"
            >
              <span className="min-w-0">
                <span className="block truncate text-base font-medium text-neutral-900">
                  {product.productName}
                </span>
                <span className="block text-meta text-neutral-500">
                  {formatQuantity(product.quantity)} units ·{" "}
                  {formatQuantity(product.purchases)}{" "}
                  {product.purchases === 1 ? "purchase" : "purchases"}
                </span>
              </span>
              <span className="num shrink-0 text-base font-semibold tabular-nums text-neutral-900">
                {formatMoney(product.total)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <SectionTitle>Recent purchases</SectionTitle>
        <ul className="mt-1 divide-y divide-neutral-100">
          {data.recentSales.map((sale) => (
            <li key={sale.id} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0">
                <Link
                  href={`/sales/${sale.id}`}
                  className="num block text-base font-medium text-primary-700 hover:underline"
                >
                  {sale.receiptNumber}
                </Link>
                <span className="block text-meta text-neutral-500">
                  {formatDateTime(sale.createdAt)} · {formatQuantity(sale.itemCount)}{" "}
                  {sale.itemCount === 1 ? "item" : "items"}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <PaymentMethodBadge method={sale.paymentMethod} size="sm" />
                {sale.status !== "COMPLETED" && (
                  <SaleStatusBadge status={sale.status} size="sm" />
                )}
                <span className="num text-base font-semibold tabular-nums text-neutral-900">
                  {formatMoney(sale.total - sale.refunded)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-neutral-50 px-3 py-2 ring-1 ring-inset ring-neutral-200">
      <dt className="text-micro font-semibold uppercase tracking-wide text-neutral-500">
        {label}
      </dt>
      <dd className="num mt-0.5 truncate text-base font-semibold text-neutral-900">
        {value}
      </dd>
    </div>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <h3 className="text-micro font-semibold uppercase tracking-wide text-neutral-500">
      {children}
    </h3>
  );
}
