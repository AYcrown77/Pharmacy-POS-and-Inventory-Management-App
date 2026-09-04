"use client";

import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import type { SortDirection } from "@/types/common";
import { EmptyState, ErrorState } from "./States";
import { SkeletonTable } from "./Skeleton";

export interface Column<T> {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** Numeric columns should be right-aligned so digits line up. */
  align?: "left" | "right" | "center";
  /** A CSS width — keeps columns stable as content changes. */
  width?: string;
  /**
   * Drop this column below the given breakpoint.
   *
   * Under `table-fixed` a narrow viewport clips cell content rather than
   * scrolling, and a truncated price ("₦900.0(") is worse than no price. So
   * lower-priority columns step aside on smaller screens and give their width
   * back to the ones that matter.
   */
  hideBelow?: "lg" | "xl";
  sortable?: boolean;
  /** Key sent to the server when sorting; defaults to `id`. */
  sortKey?: string;
  className?: string;
  headerClassName?: string;
}

export interface TableSort {
  by: string;
  dir: SortDirection;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  getRowId: (row: T) => string;

  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;

  /** Replaces the default empty state. */
  empty?: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;

  sort?: TableSort;
  onSortChange?: (sort: TableSort) => void;

  onRowClick?: (row: T) => void;
  /** Extra classes per row — e.g. tinting an expired batch. */
  rowClassName?: (row: T) => string | undefined;

  stickyHeader?: boolean;
  density?: "default" | "compact";
  /** Describes the table for screen readers. */
  caption?: string;
  className?: string;
}

const ALIGN = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
} as const;

const HIDE_BELOW = {
  lg: "hidden lg:table-cell",
  xl: "hidden xl:table-cell",
} as const;

export function DataTable<T>({
  columns,
  rows,
  getRowId,
  isLoading = false,
  isError = false,
  onRetry,
  empty,
  emptyTitle = "Nothing to show",
  emptyDescription,
  sort,
  onSortChange,
  onRowClick,
  rowClassName,
  stickyHeader = true,
  density = "default",
  caption,
  className,
}: DataTableProps<T>) {
  const rowHeight = density === "compact" ? "h-10" : "h-11";

  function toggleSort(column: Column<T>) {
    if (!column.sortable || !onSortChange) return;
    const key = column.sortKey ?? column.id;
    const isActive = sort?.by === key;
    onSortChange({
      by: key,
      dir: isActive && sort?.dir === "asc" ? "desc" : "asc",
    });
  }

  if (isError) {
    return (
      <div className={cn("rounded-lg border border-neutral-200 bg-white", className)}>
        <ErrorState onRetry={onRetry} />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative overflow-auto rounded-lg border border-neutral-200 bg-white shadow-card",
        className,
      )}
    >
      {/*
        `table-fixed` is load-bearing, not cosmetic. Under the default auto
        layout a column width is only a hint: unbreakable content — a barcode,
        "May & Baker Nigeria" — expands its column and pushes the last ones
        (usually Status and Actions) off screen at 1366px. Fixed layout makes
        the declared widths authoritative and clips instead.
      */}
      <table className="w-full table-fixed border-collapse text-base">
        {caption && <caption className="sr-only">{caption}</caption>}

        <thead
          className={cn(
            "bg-neutral-50",
            stickyHeader && "sticky top-0 z-10",
          )}
        >
          <tr className="border-b border-neutral-200">
            {columns.map((column) => {
              const key = column.sortKey ?? column.id;
              const isActive = sort?.by === key;
              const align = column.align ?? "left";

              return (
                <th
                  key={column.id}
                  scope="col"
                  style={column.width ? { width: column.width } : undefined}
                  aria-sort={
                    isActive
                      ? sort.dir === "asc"
                        ? "ascending"
                        : "descending"
                      : column.sortable
                        ? "none"
                        : undefined
                  }
                  className={cn(
                    "h-9 whitespace-nowrap px-4 text-micro font-semibold uppercase tracking-wide text-neutral-500",
                    ALIGN[align],
                    column.hideBelow && HIDE_BELOW[column.hideBelow],
                    column.headerClassName,
                  )}
                >
                  {column.sortable && onSortChange ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(column)}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-sm hover:text-neutral-800",
                        align === "right" && "flex-row-reverse",
                        isActive && "text-neutral-900",
                      )}
                    >
                      {column.header}
                      {isActive ? (
                        sort.dir === "asc" ? (
                          <ArrowUp className="size-3" aria-hidden />
                        ) : (
                          <ArrowDown className="size-3" aria-hidden />
                        )
                      ) : (
                        <ChevronsUpDown
                          className="size-3 text-neutral-300"
                          aria-hidden
                        />
                      )}
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>

        {!isLoading && rows.length > 0 && (
          <tbody>
            {rows.map((row) => {
              const interactive = Boolean(onRowClick);
              return (
                <tr
                  key={getRowId(row)}
                  onClick={interactive ? () => onRowClick?.(row) : undefined}
                  onKeyDown={
                    interactive
                      ? (event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            onRowClick?.(row);
                          }
                        }
                      : undefined
                  }
                  tabIndex={interactive ? 0 : undefined}
                  role={interactive ? "button" : undefined}
                  className={cn(
                    rowHeight,
                    "border-b border-neutral-100 last:border-b-0",
                    interactive &&
                      "cursor-pointer hover:bg-primary-50/40 focus-visible:bg-primary-50/40",
                    rowClassName?.(row),
                  )}
                >
                  {columns.map((column) => (
                    <td
                      key={column.id}
                      className={cn(
                        // Clip rather than let a long value widen the column.
                        "overflow-hidden px-4 text-neutral-700",
                        ALIGN[column.align ?? "left"],
                        column.hideBelow && HIDE_BELOW[column.hideBelow],
                        column.className,
                      )}
                    >
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        )}
      </table>

      {isLoading && (
        <SkeletonTable rows={8} columns={Math.min(columns.length, 6)} />
      )}

      {!isLoading &&
        rows.length === 0 &&
        (empty ?? (
          <EmptyState title={emptyTitle} description={emptyDescription} />
        ))}
    </div>
  );
}

/** Primary identifying cell — product name over a muted secondary line. */
export function PrimaryCell({
  title,
  subtitle,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col", className)}>
      <span className="truncate font-medium text-neutral-900">{title}</span>
      {subtitle && (
        <span className="truncate text-meta text-neutral-500">{subtitle}</span>
      )}
    </div>
  );
}

/** Right-aligned numeric cell with tabular figures. */
export function NumericCell({
  children,
  muted,
  className,
}: {
  children: ReactNode;
  muted?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "num tabular-nums",
        muted ? "text-neutral-500" : "text-neutral-900",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Placeholder for a genuinely absent value — never an empty cell. */
export function EmptyCell() {
  return (
    <span className="text-neutral-300" aria-label="Not set">
      —
    </span>
  );
}
