"use client";

import { useCallback, useMemo, useState } from "react";

import { useDebounce } from "./useDebounce";
import type { ListParams } from "@/types/common";
import type { TableSort } from "@/components/ui/DataTable";

/**
 * Paging, search, sort and filter state for a list screen.
 *
 * Every table page uses this, so the rules are applied once rather than
 * remembered per screen — in particular, changing a filter or the search term
 * always returns to page one. Landing on page 4 of a result set that now has
 * two pages is a bug users report as "the table is empty".
 */

export interface TableState<TFilters extends object> {
  page: number;
  pageSize: number;
  search: string;
  sort: TableSort;
  filters: TFilters;

  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  setSearch: (search: string) => void;
  setSort: (sort: TableSort) => void;
  setFilter: <K extends keyof TFilters>(key: K, value: TFilters[K]) => void;
  reset: () => void;

  /** True when anything beyond the default sort is applied. */
  hasActiveFilters: boolean;
  /** Merged params ready to hand to a service. */
  queryParams: ListParams & TFilters;
}

export function useTableState<TFilters extends object>({
  initialSort,
  initialFilters,
  initialPageSize = 25,
}: {
  initialSort: TableSort;
  initialFilters: TFilters;
  initialPageSize?: number;
}): TableState<TFilters> {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeRaw] = useState(initialPageSize);
  const [search, setSearchRaw] = useState("");
  const [sort, setSortRaw] = useState<TableSort>(initialSort);
  const [filters, setFilters] = useState<TFilters>(initialFilters);

  // The request follows the debounced term; the input shows the live one.
  const debouncedSearch = useDebounce(search);

  const setSearch = useCallback((value: string) => {
    setSearchRaw(value);
    setPage(1);
  }, []);

  const setPageSize = useCallback((value: number) => {
    setPageSizeRaw(value);
    setPage(1);
  }, []);

  const setSort = useCallback((value: TableSort) => {
    setSortRaw(value);
    setPage(1);
  }, []);

  const setFilter = useCallback(
    <K extends keyof TFilters>(key: K, value: TFilters[K]) => {
      setFilters((current) => ({ ...current, [key]: value }));
      setPage(1);
    },
    [],
  );

  const reset = useCallback(() => {
    setSearchRaw("");
    setFilters(initialFilters);
    setPage(1);
  }, [initialFilters]);

  const hasActiveFilters =
    search.trim().length > 0 ||
    Object.values(filters).some(
      (value) => value !== undefined && value !== "" && value !== null,
    );

  const queryParams = useMemo(
    () =>
      ({
        page,
        pageSize,
        search: debouncedSearch.trim() || undefined,
        sortBy: sort.by,
        sortDir: sort.dir,
        ...filters,
      }) as ListParams & TFilters,
    [page, pageSize, debouncedSearch, sort, filters],
  );

  return {
    page,
    pageSize,
    search,
    sort,
    filters,
    setPage,
    setPageSize,
    setSearch,
    setSort,
    setFilter,
    reset,
    hasActiveFilters,
    queryParams,
  };
}
