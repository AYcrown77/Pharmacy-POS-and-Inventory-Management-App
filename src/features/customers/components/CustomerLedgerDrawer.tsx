"use client";

import { useQuery } from "@tanstack/react-query";
import { ScrollText } from "lucide-react";

import { Drawer } from "@/components/ui/Drawer";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/date";
import { formatMoney } from "@/lib/money";
import { customersService } from "@/services/customers.service";
import type { Customer, LedgerEntryType } from "@/types/domain";

const ENTRY_LABELS: Record<LedgerEntryType, string> = {
  CHARGE: "Taken on account",
  REPAYMENT: "Payment received",
  REVERSAL: "Returned goods",
  ADJUSTMENT: "Adjustment",
};

/**
 * The statement behind a balance.
 *
 * Newest first, with the running balance beside every entry — because the
 * question someone opens this to answer is "why do I owe that?", and a list
 * of amounts alone cannot answer it.
 */
export function CustomerLedgerDrawer({
  customer,
  open,
  onOpenChange,
}: {
  customer: Customer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const ledger = useQuery({
    queryKey: ["customers", "ledger", customer?.id],
    queryFn: () => customersService.getLedger(customer!.id, { pageSize: 100 }),
    enabled: open && Boolean(customer),
  });

  const entries = ledger.data?.entries.data ?? [];
  const balance = ledger.data?.customer.balance ?? customer?.balance ?? 0;

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={customer?.name ?? "Statement"}
      description={customer?.phone ?? undefined}
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
              balance > 0 ? "text-danger-700" : balance < 0 ? "text-success-700" : "text-neutral-500",
            )}
          >
            {formatMoney(Math.abs(balance))}
          </p>
        </div>

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
            <li key={entry.id} className="flex items-start justify-between gap-3 py-2.5">
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
                  <span className="block text-meta text-neutral-500">{entry.reason}</span>
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
      </div>
    </Drawer>
  );
}
