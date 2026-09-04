"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { NativeSelect, SearchInput } from "@/components/ui/Input";
import type { SelectOption } from "@/types/common";

/**
 * One row of controls above every table: search on the left, dimension
 * filters beside it, a clear action once something is applied.
 */
export function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder = "Search…",
  hasActiveFilters,
  onReset,
  children,
  trailing,
  className,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  hasActiveFilters?: boolean;
  onReset?: () => void;
  /** Filter selects. */
  children?: ReactNode;
  /** Right-aligned extras, e.g. an export or print button. */
  trailing?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <div className="w-full min-w-48 sm:w-64">
        <SearchInput
          inputSize="sm"
          value={search}
          placeholder={searchPlaceholder}
          onChange={(event) => onSearchChange(event.target.value)}
          onClear={() => onSearchChange("")}
          aria-label={searchPlaceholder}
        />
      </div>

      {children}

      {hasActiveFilters && onReset && (
        <Button
          size="sm"
          variant="ghost"
          onClick={onReset}
          leadingIcon={<X className="size-3.5" />}
        >
          Clear
        </Button>
      )}

      {trailing && <div className="ml-auto flex items-center gap-2">{trailing}</div>}
    </div>
  );
}

/**
 * A labelled dropdown filter. The label is visually hidden — the "All …"
 * default option already names the dimension, and a row of visible labels
 * would double the height of the bar.
 */
export function FilterSelect<T extends string>({
  label,
  value,
  onChange,
  options,
  allLabel,
  className,
}: {
  label: string;
  value: T | undefined;
  onChange: (value: T | undefined) => void;
  options: SelectOption<T>[];
  allLabel: string;
  className?: string;
}) {
  return (
    <label className={cn("shrink-0", className)}>
      <span className="sr-only">{label}</span>
      <NativeSelect
        selectSize="sm"
        value={value ?? ""}
        onChange={(event) =>
          onChange((event.target.value || undefined) as T | undefined)
        }
        className="w-auto min-w-40"
      >
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </NativeSelect>
    </label>
  );
}
