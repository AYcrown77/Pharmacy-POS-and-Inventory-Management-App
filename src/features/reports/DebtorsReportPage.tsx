"use client";

import { useQuery } from "@tanstack/react-query";
import { HandCoins } from "lucide-react";
import { useMemo } from "react";

import {
  DataTable,
  NumericCell,
  PrimaryCell,
  type Column,
} from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/States";
import { cn } from "@/lib/cn";
import { csvMoney, csvNumber, exportCsv } from "@/lib/csv";
import { formatMoney, formatMoneyCompact, formatQuantity } from "@/lib/money";
import { reportsService } from "@/services/reports.service";
import type { DebtorRow } from "@/types/analytics";
import { ReportShell, ReportSummary } from "./components/ReportShell";

/**
 * Who owes the pharmacy money.
 *
 * Ordered by balance, because the amount is what decides whether chasing is
 * worth the phone call. "Since last payment" counts from the last money in
 * rather than from when the debt began: an account paying something weekly is
 * not a problem however old its oldest charge is, and one silent for three
 * months is, even if the debt is recent.
 */
export function DebtorsReportPage() {
  const list = useQuery({
    queryKey: ["reports", "debtors"],
    queryFn: () => reportsService.debtors(),
  });

  const rows = useMemo(() => list.data ?? [], [list.data]);

  const totalOwed = useMemo(
    () => rows.reduce((total, row) => total + row.balance, 0),
    [rows],
  );

  /** Accounts silent for over a month — the ones worth a call. */
  const stale = useMemo(
    () =>
      rows.filter(
        (row) => row.daysSinceLastPayment === null || row.daysSinceLastPayment > 30,
      ).length,
    [rows],
  );

  const columns = useMemo<Column<DebtorRow>[]>(
    () => [
      {
        id: "customer",
        header: "Customer",
        width: "34%",
        cell: (row) => (
          <PrimaryCell
            title={row.customerName}
            subtitle={row.phone ?? "No phone number"}
          />
        ),
      },
      {
        id: "balance",
        header: "Owing",
        align: "right",
        width: "22%",
        cell: (row) => (
          <NumericCell className="font-semibold text-danger-700">
            {formatMoney(row.balance)}
          </NumericCell>
        ),
      },
      {
        id: "sinceLastPayment",
        header: "Since last payment",
        align: "right",
        width: "24%",
        cell: (row) => (
          <span
            className={cn(
              "num whitespace-nowrap",
              row.daysSinceLastPayment === null || row.daysSinceLastPayment > 30
                ? "font-medium text-warning-800"
                : "text-neutral-600",
            )}
          >
            {row.daysSinceLastPayment === null
              ? "Never paid"
              : row.daysSinceLastPayment === 0
                ? "Today"
                : `${formatQuantity(row.daysSinceLastPayment)} days`}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <ReportShell
      title="Debtors"
      description="Accounts carrying a balance, largest first."
      onExport={() =>
        exportCsv("debtors report", [
          { header: "Customer", value: (row) => row.customerName },
          { header: "Phone", value: (row) => row.phone },
          { header: "Owing", value: (row) => csvMoney(row.balance) },
          {
            header: "Days since last payment",
            value: (row) =>
              row.daysSinceLastPayment === null
                ? ""
                : csvNumber(row.daysSinceLastPayment),
          },
        ], rows)
      }
      filters={null}
      summary={
        <ReportSummary
          columns={3}
          isPending={list.isPending}
          items={[
            { label: "Accounts owing", value: formatQuantity(rows.length) },
            {
              label: "Total owed",
              value: formatMoneyCompact(totalOwed),
              tone: totalOwed > 0 ? "warning" : undefined,
              accent: totalOwed > 0,
            },
            {
              label: "Quiet over 30 days",
              value: formatQuantity(stale),
              tone: stale > 0 ? "danger" : undefined,
              accent: stale > 0,
              context: "Worth a phone call",
            },
          ]}
        />
      }
    >
      <DataTable
        caption="Outstanding balances"
        columns={columns}
        rows={rows}
        getRowId={(row) => row.customerId}
        isLoading={list.isPending}
        isError={list.isError}
        onRetry={() => void list.refetch()}
        empty={
          <EmptyState
            icon={<HandCoins className="size-5" />}
            title="Nothing is owed"
            description="Every customer account is settled."
          />
        }
      />
    </ReportShell>
  );
}
