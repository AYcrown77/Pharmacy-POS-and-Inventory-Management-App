"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/cn";
import { formatQuantity } from "@/lib/money";
import { NativeSelect } from "./Input";

export interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}

export function Pagination({
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [25, 50, 100],
  className,
}: PaginationProps) {
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 px-1",
        className,
      )}
    >
      <p className="text-meta text-neutral-500" aria-live="polite">
        Showing{" "}
        <span className="num font-medium text-neutral-700">
          {formatQuantity(first)}–{formatQuantity(last)}
        </span>{" "}
        of{" "}
        <span className="num font-medium text-neutral-700">
          {formatQuantity(total)}
        </span>
      </p>

      <div className="flex items-center gap-3">
        {onPageSizeChange && (
          <label className="flex items-center gap-2 text-meta text-neutral-500">
            Rows
            <NativeSelect
              selectSize="sm"
              value={pageSize}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              className="w-[4.5rem]"
              aria-label="Rows per page"
            >
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </NativeSelect>
          </label>
        )}

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
            className="inline-flex size-8 items-center justify-center rounded-md text-neutral-600 ring-1 ring-inset ring-neutral-300 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <ChevronLeft className="size-4" />
          </button>

          <span className="num min-w-[6.5rem] text-center text-meta text-neutral-600">
            Page {page} of {Math.max(totalPages, 1)}
          </span>

          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            aria-label="Next page"
            className="inline-flex size-8 items-center justify-center rounded-md text-neutral-600 ring-1 ring-inset ring-neutral-300 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
