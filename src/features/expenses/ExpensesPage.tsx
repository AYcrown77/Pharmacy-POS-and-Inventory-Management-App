"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Plus, Wallet } from "lucide-react";
import { useMemo, useState } from "react";

import { DateRangeFilter } from "@/components/shared/DateRangeFilter";
import { FilterSelect } from "@/components/shared/FilterBar";
import { ExpenseStatusBadge } from "@/components/shared/StatusBadges";
import { Button } from "@/components/ui/Button";
import {
  DataTable,
  NumericCell,
  PrimaryCell,
  type Column,
} from "@/components/ui/DataTable";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { StatCard } from "@/components/ui/StatCard";
import { EmptyState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { toErrorMessage } from "@/lib/api/http";
import { useCan } from "@/lib/auth/AuthProvider";
import { cn } from "@/lib/cn";
import { formatDate, resolveDateRange, type DateRangePreset } from "@/lib/date";
import { formatMoney, formatQuantity } from "@/lib/money";
import { expenseKeys, reportKeys } from "@/lib/query/keys";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_STATUS_LABELS,
  PAYMENT_METHOD_SHORT_LABELS,
} from "@/lib/status";
import {
  expensesService,
  type ExpenseInput,
} from "@/services/expenses.service";
import type { DateRange } from "@/types/common";
import type { Expense, ExpenseCategory, ExpenseStatus } from "@/types/domain";
import { RecordExpenseModal } from "./components/RecordExpenseModal";
import { VoidExpenseModal } from "./components/VoidExpenseModal";

/**
 * Money paid out of the business.
 *
 * Recorded at the counter as it happens — the generator's diesel, a delivery
 * fee — so the day's takings can be read net of what was spent. An entry made
 * in error is voided by an administrator, never deleted: it stays visible,
 * struck through, with the reason beside it.
 */
export function ExpensesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canVoid = useCan("expenses:void");
  const seesEveryone = useCan("sales:read:all");

  const [preset, setPreset] = useState<DateRangePreset>("today");
  const [range, setRange] = useState<DateRange>(() => resolveDateRange("today"));
  const [category, setCategory] = useState<ExpenseCategory | undefined>();
  const [status, setStatus] = useState<ExpenseStatus | undefined>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [recording, setRecording] = useState(false);
  const [voiding, setVoiding] = useState<Expense | null>(null);

  const filters = { ...range, category, status, page, pageSize };

  const list = useQuery({
    queryKey: expenseKeys.list(filters),
    queryFn: () => expensesService.list(filters),
    placeholderData: keepPreviousData,
  });

  const summary = useQuery({
    queryKey: expenseKeys.summary(range),
    queryFn: () => expensesService.summary(range),
  });

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: expenseKeys.all });
    // The sales report takes expenses off its takings, so it is stale too.
    void queryClient.invalidateQueries({ queryKey: reportKeys.all });
  }

  const record = useMutation({
    mutationFn: (input: ExpenseInput) => expensesService.record(input),
    onSuccess: (expense) => {
      refresh();
      setRecording(false);
      toast({
        tone: "success",
        title: "Expense recorded",
        description: `${formatMoney(expense.amount)} · ${EXPENSE_CATEGORY_LABELS[expense.category]}`,
      });
    },
    onError: (error) =>
      toast({
        tone: "error",
        title: "Could not record it",
        description: toErrorMessage(error),
      }),
  });

  const voidExpense = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      expensesService.voidExpense(id, reason),
    onSuccess: (expense) => {
      refresh();
      setVoiding(null);
      toast({
        tone: "success",
        title: "Expense voided",
        description: `${formatMoney(expense.amount)} no longer counts against takings.`,
      });
    },
    onError: (error) =>
      toast({
        tone: "error",
        title: "Could not void it",
        description: toErrorMessage(error),
      }),
  });

  const columns = useMemo<Column<Expense>[]>(
    () => [
      {
        id: "expenseDate",
        header: "Date",
        width: "12%",
        cell: (expense) => (
          <span className="num whitespace-nowrap text-neutral-600">
            {formatDate(expense.expenseDate)}
          </span>
        ),
      },
      {
        id: "reason",
        header: "What for",
        width: canVoid ? "32%" : "40%",
        cell: (expense) => (
          <PrimaryCell
            title={expense.reason}
            subtitle={
              expense.status === "VOIDED"
                ? `Voided by ${expense.voidedByName ?? "an administrator"}: ${expense.voidReason ?? ""}`
                : EXPENSE_CATEGORY_LABELS[expense.category]
            }
          />
        ),
      },
      {
        id: "paymentMethod",
        header: "Paid with",
        width: "10%",
        hideBelow: "lg",
        cell: (expense) => (
          <span className="text-neutral-600">
            {PAYMENT_METHOD_SHORT_LABELS[expense.paymentMethod]}
          </span>
        ),
      },
      {
        id: "recordedBy",
        header: "Recorded by",
        width: "15%",
        hideBelow: "lg",
        cell: (expense) => (
          <span className="block truncate text-neutral-600">
            {expense.recordedByName}
          </span>
        ),
      },
      {
        id: "status",
        header: "Status",
        width: "11%",
        cell: (expense) => <ExpenseStatusBadge status={expense.status} size="sm" />,
      },
      {
        id: "amount",
        header: "Amount",
        align: "right",
        width: "12%",
        cell: (expense) => (
          <NumericCell
            className={cn(
              "font-semibold",
              expense.status === "VOIDED" && "text-neutral-400 line-through",
            )}
          >
            {formatMoney(expense.amount)}
          </NumericCell>
        ),
      },
      ...(canVoid
        ? [
            {
              id: "actions",
              header: <span className="sr-only">Actions</span>,
              align: "right" as const,
              width: "8%",
              cell: (expense: Expense) =>
                expense.status === "RECORDED" ? (
                  <Button size="sm" variant="ghost" onClick={() => setVoiding(expense)}>
                    Void
                  </Button>
                ) : null,
            },
          ]
        : []),
    ],
    [canVoid],
  );

  const largest = summary.data?.byCategory[0];
  const spentCount = summary.data?.count ?? 0;

  return (
    <PageContainer>
      <PageHeader
        title="Expenses"
        description={
          seesEveryone
            ? "Money paid out of the business. The sales report takes it off the day's takings."
            : "Money you have paid out. An administrator can void an entry made in error."
        }
        actions={
          <Button
            variant="primary"
            leadingIcon={<Plus className="size-4" />}
            onClick={() => setRecording(true)}
          >
            Record expense
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          size="sm"
          label="Spent in this period"
          value={formatMoney(summary.data?.total ?? 0)}
          context={`${formatQuantity(spentCount)} ${spentCount === 1 ? "expense" : "expenses"}, voided ones excluded`}
        />
        <StatCard
          size="sm"
          label="Largest category"
          value={largest ? EXPENSE_CATEGORY_LABELS[largest.category] : "—"}
          context={largest ? formatMoney(largest.total) : "Nothing spent"}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <DateRangeFilter
          preset={preset}
          range={range}
          onChange={(nextPreset, nextRange) => {
            setPreset(nextPreset);
            setRange(nextRange);
            setPage(1);
          }}
        />
        <FilterSelect
          label="Category"
          allLabel="All categories"
          value={category}
          onChange={(value) => {
            setCategory(value);
            setPage(1);
          }}
          options={EXPENSE_CATEGORIES.map((value) => ({
            value,
            label: EXPENSE_CATEGORY_LABELS[value],
          }))}
        />
        <FilterSelect
          label="Status"
          allLabel="Any status"
          value={status}
          onChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
          options={(["RECORDED", "VOIDED"] as const).map((value) => ({
            value,
            label: EXPENSE_STATUS_LABELS[value],
          }))}
        />
      </div>

      <DataTable
        caption="Expenses"
        columns={columns}
        rows={list.data?.data ?? []}
        getRowId={(expense) => expense.id}
        isLoading={list.isPending}
        isError={list.isError}
        onRetry={() => void list.refetch()}
        empty={
          <EmptyState
            icon={<Wallet className="size-5" />}
            title="No expenses in this period"
            description="Record fuel, deliveries, repairs — anything paid out of the business."
          />
        }
      />

      <Pagination
        page={list.data?.page ?? 1}
        pageSize={list.data?.pageSize ?? pageSize}
        total={list.data?.total ?? 0}
        totalPages={list.data?.totalPages ?? 1}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
      />

      <RecordExpenseModal
        key={recording ? "recording" : "idle"}
        open={recording}
        onOpenChange={setRecording}
        isSubmitting={record.isPending}
        onSubmit={(input) => record.mutate(input)}
      />

      <VoidExpenseModal
        key={voiding?.id ?? "none"}
        expense={voiding}
        open={Boolean(voiding)}
        onOpenChange={(open) => !open && setVoiding(null)}
        isSubmitting={voidExpense.isPending}
        onSubmit={(reason) =>
          voiding && voidExpense.mutate({ id: voiding.id, reason })
        }
      />
    </PageContainer>
  );
}
