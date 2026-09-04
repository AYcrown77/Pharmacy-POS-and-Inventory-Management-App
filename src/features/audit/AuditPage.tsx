"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ClipboardList, Eye } from "lucide-react";
import { useMemo, useState } from "react";

import { DateRangeFilter } from "@/components/shared/DateRangeFilter";
import { FilterBar, FilterSelect } from "@/components/shared/FilterBar";
import { AuditActionBadge } from "@/components/shared/StatusBadges";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  DataTable,
  EmptyCell,
  PrimaryCell,
  type Column,
} from "@/components/ui/DataTable";
import { Drawer } from "@/components/ui/Drawer";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/States";
import { useTableState } from "@/hooks/useTableState";
import {
  formatDateTime,
  formatRelativeTime,
  resolveDateRange,
  type DateRangePreset,
} from "@/lib/date";
import { auditKeys } from "@/lib/query/keys";
import { AUDIT_ACTION_LABELS, AUDIT_ACTIONS } from "@/lib/status";
import { auditService } from "@/services/audit.service";
import { useCashiers } from "@/features/sales/hooks";
import type { DateRange } from "@/types/common";
import type { AuditAction, AuditLog } from "@/types/domain";
import { AuditDetail } from "./components/AuditDetail";
import { summariseChange } from "./format";

interface AuditTableFilters {
  userId?: string;
  action?: AuditAction;
  entityType?: string;
}

export function AuditPage() {
  const [preset, setPreset] = useState<DateRangePreset>("this-month");
  const [range, setRange] = useState<DateRange>(() =>
    resolveDateRange("this-month"),
  );
  const [selected, setSelected] = useState<AuditLog | null>(null);

  const table = useTableState<AuditTableFilters>({
    initialSort: { by: "createdAt", dir: "desc" },
    initialFilters: {},
  });

  const filters = { ...table.queryParams, from: range.from, to: range.to };

  const list = useQuery({
    queryKey: auditKeys.list(filters),
    queryFn: () => auditService.list(filters),
    placeholderData: keepPreviousData,
  });

  const entityTypes = useQuery({
    queryKey: [...auditKeys.all, "entity-types"],
    queryFn: () => auditService.listEntityTypes(),
    staleTime: 5 * 60_000,
  });

  const users = useCashiers();

  const columns = useMemo<Column<AuditLog>[]>(
    () => [
      {
        id: "createdAt",
        header: "Timestamp",
        sortable: true,
        width: "180px",
        cell: (entry) => (
          <div className="flex flex-col whitespace-nowrap">
            <span className="num">{formatDateTime(entry.createdAt)}</span>
            <span className="text-meta text-neutral-500">
              {formatRelativeTime(entry.createdAt)}
            </span>
          </div>
        ),
      },
      {
        id: "userName",
        header: "User",
        width: "160px",
        cell: (entry) => (
          <PrimaryCell title={entry.userName} />
        ),
      },
      {
        id: "action",
        header: "Action",
        width: "168px",
        cell: (entry) => <AuditActionBadge action={entry.action} size="sm" />,
      },
      {
        id: "entityType",
        hideBelow: "xl",
        header: "Entity",
        width: "120px",
        cell: (entry) => (
          <Badge tone="neutral" size="sm">
            {entry.entityType}
          </Badge>
        ),
      },
      {
        id: "details",
        header: "Details",
        cell: (entry) => {
          const summary = summariseChange(entry);
          return summary ? (
            <span className="block truncate text-neutral-600" title={summary}>
              {summary}
            </span>
          ) : (
            <EmptyCell />
          );
        },
      },
      {
        id: "open",
        header: <span className="sr-only">Open</span>,
        align: "right",
        width: "48px",
        cell: (entry) => (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setSelected(entry);
            }}
            aria-label={`View details of ${AUDIT_ACTION_LABELS[entry.action]} by ${entry.userName}`}
            className="flex size-8 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
          >
            <Eye className="size-4" />
          </button>
        ),
      },
    ],
    [],
  );

  return (
    <PageContainer>
      <PageHeader
        title="Audit log"
        titleHidden
        description="A permanent record of who did what. Entries are written by the actions themselves and cannot be edited or removed."
      />

      <FilterBar
        search={table.search}
        onSearchChange={table.setSearch}
        searchPlaceholder="Search user or entity"
        hasActiveFilters={table.hasActiveFilters}
        onReset={table.reset}
      >
        <DateRangeFilter
          preset={preset}
          range={range}
          onChange={(nextPreset, nextRange) => {
            setPreset(nextPreset);
            setRange(nextRange);
            table.setPage(1);
          }}
        />
        <FilterSelect
          label="User"
          allLabel="All users"
          value={table.filters.userId}
          onChange={(value) => table.setFilter("userId", value)}
          options={
            users.data?.data.map((user) => ({
              value: user.id,
              label: user.name,
            })) ?? []
          }
        />
        <FilterSelect
          label="Action"
          allLabel="All actions"
          value={table.filters.action}
          onChange={(value) => table.setFilter("action", value)}
          options={AUDIT_ACTIONS.map((action) => ({
            value: action,
            label: AUDIT_ACTION_LABELS[action],
          }))}
        />
        <FilterSelect
          label="Entity"
          allLabel="All entities"
          value={table.filters.entityType}
          onChange={(value) => table.setFilter("entityType", value)}
          options={(entityTypes.data ?? []).map((type) => ({
            value: type,
            label: type,
          }))}
        />
      </FilterBar>

      <DataTable
        caption="Audit log entries"
        columns={columns}
        rows={list.data?.data ?? []}
        getRowId={(entry) => entry.id}
        isLoading={list.isPending}
        isError={list.isError}
        onRetry={() => void list.refetch()}
        sort={table.sort}
        onSortChange={table.setSort}
        onRowClick={setSelected}
        density="compact"
        className={
          list.isPlaceholderData ? "opacity-60 transition-opacity" : undefined
        }
        empty={
          <EmptyState
            icon={<ClipboardList className="size-5" />}
            title="No entries in this period"
            description="Try a wider date range or clear the filters."
            action={
              table.hasActiveFilters ? (
                <Button variant="secondary" onClick={table.reset}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        }
      />

      {list.data && list.data.total > 0 && (
        <Pagination
          page={list.data.page}
          pageSize={list.data.pageSize}
          total={list.data.total}
          totalPages={list.data.totalPages}
          onPageChange={table.setPage}
          onPageSizeChange={table.setPageSize}
        />
      )}

      <Drawer
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setSelected(null)}
        title={selected ? AUDIT_ACTION_LABELS[selected.action] : ""}
        description={
          selected
            ? `${selected.userName} · ${formatDateTime(selected.createdAt)}`
            : undefined
        }
        width="lg"
      >
        {selected && <AuditDetail entry={selected} />}
      </Drawer>
    </PageContainer>
  );
}

