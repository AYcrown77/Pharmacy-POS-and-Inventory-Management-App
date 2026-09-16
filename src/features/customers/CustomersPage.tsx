"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HandCoins, Users2 } from "lucide-react";
import { useMemo, useState } from "react";

import { FilterBar, FilterSelect } from "@/components/shared/FilterBar";
import { Button } from "@/components/ui/Button";
import { DataTable, NumericCell, PrimaryCell, type Column } from "@/components/ui/DataTable";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { StatCard } from "@/components/ui/StatCard";
import { EmptyState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { useTableState } from "@/hooks/useTableState";
import { toErrorMessage } from "@/lib/api/http";
import { cn } from "@/lib/cn";
import { formatRelativeTime } from "@/lib/date";
import { formatMoney, formatQuantity } from "@/lib/money";
import { customersService } from "@/services/customers.service";
import type { Customer } from "@/types/domain";
import { CustomerDrawer } from "./components/CustomerDrawer";
import { RepaymentModal } from "./components/RepaymentModal";

interface CustomerFilters extends Record<string, unknown> {
  owing?: boolean;
}

/**
 * Accounts: what each owes, and how each buys.
 *
 * Balance still sits beside the name — "who owes us money" is the question
 * this page is most often opened for — but spending, visits and the last
 * purchase now sit next to it, and every one of them sorts across the whole
 * book, so the pharmacy's best customers are one click away.
 */
export function CustomersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const table = useTableState<CustomerFilters>({
    initialSort: { by: "name", dir: "asc" },
    initialFilters: {},
  });
  const [viewing, setViewing] = useState<Customer | null>(null);
  const [repaying, setRepaying] = useState<Customer | null>(null);

  const list = useQuery({
    queryKey: ["customers", "list", table.queryParams],
    queryFn: () => customersService.list(table.queryParams),
    placeholderData: keepPreviousData,
  });

  const rows = useMemo(() => list.data?.data ?? [], [list.data]);

  /** Total outstanding across the page — a floor, not the whole book. */
  const owedOnPage = useMemo(
    () => rows.reduce((total, customer) => total + Math.max(customer.balance, 0), 0),
    [rows],
  );

  const repay = useMutation({
    mutationFn: ({
      id,
      amount,
      allowOverpayment,
    }: {
      id: string;
      amount: number;
      allowOverpayment?: boolean;
    }) =>
      customersService.recordRepayment(id, {
        amount,
        reason: null,
        allowOverpayment,
      }),
    onSuccess: ({ customer }) => {
      void queryClient.invalidateQueries({ queryKey: ["customers"] });
      setRepaying(null);
      toast({
        tone: "success",
        title: "Repayment recorded",
        description:
          customer.balance > 0
            ? `${customer.name} now owes ${formatMoney(customer.balance)}.`
            : `${customer.name}'s account is settled.`,
      });
    },
    onError: (error) =>
      toast({ tone: "error", title: "Could not record it", description: toErrorMessage(error) }),
  });

  const columns = useMemo<Column<Customer>[]>(
    () => [
      {
        id: "name",
        header: "Customer",
        width: "25%",
        sortable: true,
        cell: (customer) => (
          <PrimaryCell title={customer.name} subtitle={customer.phone ?? "No phone number"} />
        ),
      },
      {
        id: "balance",
        header: "Balance",
        align: "right",
        width: "14%",
        sortable: true,
        cell: (customer) => (
          <NumericCell
            className={cn(
              "font-semibold",
              customer.balance > 0
                ? "text-danger-700"
                : customer.balance < 0
                  ? "text-success-700"
                  : "text-neutral-400",
            )}
          >
            {customer.balance === 0
              ? "Settled"
              : customer.balance > 0
                ? formatMoney(customer.balance)
                : `${formatMoney(-customer.balance)} credit`}
          </NumericCell>
        ),
      },
      {
        id: "totalSpent",
        header: "Total spent",
        align: "right",
        width: "14%",
        sortable: true,
        cell: (customer) => (
          <NumericCell className="font-medium">
            {formatMoney(customer.totalSpent ?? 0)}
          </NumericCell>
        ),
      },
      {
        id: "purchaseCount",
        header: "Purchases",
        align: "right",
        width: "10%",
        sortable: true,
        hideBelow: "lg",
        cell: (customer) => (
          <NumericCell muted>{formatQuantity(customer.purchaseCount ?? 0)}</NumericCell>
        ),
      },
      {
        id: "lastPurchaseAt",
        header: "Last purchase",
        width: "14%",
        sortable: true,
        hideBelow: "lg",
        cell: (customer) => (
          <span className="whitespace-nowrap text-neutral-600">
            {customer.lastPurchaseAt ? formatRelativeTime(customer.lastPurchaseAt) : "Never"}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        width: "23%",
        cell: (customer) => (
          <div className="flex justify-end gap-1.5">
            <Button size="sm" variant="ghost" onClick={() => setViewing(customer)}>
              Details
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={customer.balance <= 0}
              leadingIcon={<HandCoins className="size-4" />}
              onClick={() => setRepaying(customer)}
            >
              Take payment
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <PageContainer>
      <PageHeader
        title="Customers"
        description="Accounts: what each one owes, and how each one buys."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard size="sm" label="Accounts" value={String(list.data?.total ?? 0)} />
        <StatCard
          size="sm"
          label="Owed on this page"
          value={formatMoney(owedOnPage)}
          tone={owedOnPage > 0 ? "warning" : undefined}
          accent={owedOnPage > 0}
        />
      </div>

      <FilterBar
        search={table.search}
        onSearchChange={table.setSearch}
        searchPlaceholder="Search name or phone"
        hasActiveFilters={table.hasActiveFilters}
        onReset={table.reset}
      >
        <FilterSelect
          label="Balance"
          allLabel="All accounts"
          value={table.filters.owing ? "owing" : undefined}
          onChange={(value) => table.setFilter("owing", value === "owing" ? true : undefined)}
          options={[{ value: "owing", label: "Owing only" }]}
        />
      </FilterBar>

      <DataTable
        caption="Customer accounts"
        columns={columns}
        rows={rows}
        getRowId={(customer) => customer.id}
        isLoading={list.isPending}
        isError={list.isError}
        onRetry={() => void list.refetch()}
        sort={table.sort}
        onSortChange={table.setSort}
        empty={
          <EmptyState
            icon={<Users2 className="size-5" />}
            title="No customer accounts yet"
            description="Accounts are created at the till when a customer is attached to a sale."
          />
        }
      />

      <Pagination
        page={list.data?.page ?? 1}
        pageSize={list.data?.pageSize ?? 25}
        total={list.data?.total ?? 0}
        totalPages={list.data?.totalPages ?? 1}
        onPageChange={table.setPage}
        onPageSizeChange={table.setPageSize}
      />

      <CustomerDrawer
        key={viewing?.id ?? "none"}
        customer={viewing}
        open={Boolean(viewing)}
        onOpenChange={(open: boolean) => !open && setViewing(null)}
      />

      <RepaymentModal
        key={`repay-${repaying?.id ?? "none"}`}
        customer={repaying}
        open={Boolean(repaying)}
        onOpenChange={(open) => !open && setRepaying(null)}
        isSubmitting={repay.isPending}
        onSubmit={(amount, allowOverpayment) =>
          repay.mutateAsync({ id: repaying!.id, amount, allowOverpayment })
        }
      />
    </PageContainer>
  );
}
