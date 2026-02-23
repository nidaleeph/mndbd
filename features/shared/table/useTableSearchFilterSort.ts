"use client";

import { useState, useMemo, useCallback } from "react";

export type SortDirection = "asc" | "desc" | null;

/** Get nested value by path like "ministry.name" */
function getByPath<T>(row: T, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = row;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/** Extract searchable string from row for a given key path */
function getSearchString<T>(row: T, key: string): string {
  const val = getByPath(row, key);
  if (val == null) return "";
  if (typeof val === "string") return val;
  if (typeof val === "number") return String(val);
  if (val instanceof Date) return val.toISOString();
  if (typeof val === "object" && "name" in val) return String((val as { name: unknown }).name);
  return String(val);
}

export interface FilterConfig<T> {
  accessor: (row: T) => string | string[];
  options: string[];
}

export interface SortConfig<T> {
  accessor: (row: T) => string | number | Date | null | undefined;
}

export interface TableSearchFilterSortConfig<T> {
  /** Dot-notation paths (e.g. "ministry.name") or custom getter for search */
  searchKeys: readonly (string | ((row: T) => string))[];
  filterableColumns?: Record<string, FilterConfig<T>>;
  sortableColumns?: Record<string, SortConfig<T>>;
}

export interface TableSearchFilterSortState {
  search: string;
  filters: Record<string, string[]>;
  sortColumn: string | null;
  sortDirection: SortDirection;
}

export interface UseTableSearchFilterSortReturn<T> {
  filteredData: T[];
  search: string;
  setSearch: (v: string) => void;
  filters: Record<string, string[]>;
  setFilter: (columnId: string, values: string[]) => void;
  clearAllFilters: () => void;
  sortColumn: string | null;
  sortDirection: SortDirection;
  setSort: (columnId: string) => void;
  activeFilterCount: number;
}

/**
 * Hook for client-side search, filter, and sort.
 * - Search: case-insensitive substring match across searchKeys
 * - Filters: AND across columns; OR within column (any selected value matches)
 * - Sort: toggle asc -> desc -> null on repeated clicks
 */
export function useTableSearchFilterSort<T>(
  data: T[],
  config: TableSearchFilterSortConfig<T>
): UseTableSearchFilterSortReturn<T> {
  const [search, setSearch] = useState("");
  const [filters, setFiltersState] = useState<Record<string, string[]>>({});
  const [sort, setSortState] = useState<{ column: string; direction: "asc" | "desc" } | null>(null);

  const setFilter = useCallback((columnId: string, values: string[]) => {
    setFiltersState((prev) => ({
      ...prev,
      [columnId]: values,
    }));
  }, []);

  const clearAllFilters = useCallback(() => {
    setFiltersState({});
  }, []);

  const setSort = useCallback(
    (columnId: string) => {
      if (config.sortableColumns && !(columnId in config.sortableColumns)) return;
      setSortState((prev) => {
        if (!prev || prev.column !== columnId) return { column: columnId, direction: "asc" };
        if (prev.direction === "asc") return { column: columnId, direction: "desc" };
        return null;
      });
    },
    [config.sortableColumns]
  );

  const sortColumn = sort?.column ?? null;
  const sortDirection = sort?.direction ?? null;

  const filteredData = useMemo(() => {
    let result = data;

    // Apply search
    const q = search.trim().toLowerCase();
    if (q && config.searchKeys.length > 0) {
      result = result.filter((row) => {
        return config.searchKeys.some((key) => {
          const str =
            typeof key === "function"
              ? key(row).toLowerCase()
              : getSearchString(row, key).toLowerCase();
          return str.includes(q);
        });
      });
    }

    // Apply filters (AND across columns)
    if (config.filterableColumns) {
      for (const [colId, selected] of Object.entries(filters)) {
        if (selected.length === 0) continue;
        const colConfig = config.filterableColumns[colId];
        if (!colConfig) continue;
        result = result.filter((row) => {
          const val = colConfig.accessor(row);
          const vals = Array.isArray(val) ? val : [val];
          const normalized = vals.map((v) => String(v ?? "").trim());
          return selected.some((s) => normalized.includes(s));
        });
      }
    }

    // Apply sort
    if (
      sortColumn &&
      sortDirection &&
      config.sortableColumns &&
      sortColumn in config.sortableColumns
    ) {
      const sortConfig = config.sortableColumns[sortColumn];
      result = [...result].sort((a, b) => {
        const va = sortConfig.accessor(a);
        const vb = sortConfig.accessor(b);
        const aNull = va == null;
        const bNull = vb == null;
        if (aNull && bNull) return 0;
        if (aNull) return 1;
        if (bNull) return -1;
        let cmp: number;
        if (typeof va === "string" && typeof vb === "string") {
          cmp = va.localeCompare(vb, undefined, { sensitivity: "base" });
        } else {
          const aVal = va as number | Date;
          const bVal = vb as number | Date;
          cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        }
        return sortDirection === "asc" ? cmp : -cmp;
      });
    }

    return result;
  }, [
    data,
    search,
    filters,
    sortColumn,
    sortDirection,
    config.searchKeys,
    config.filterableColumns,
    config.sortableColumns,
  ]);

  const activeFilterCount = useMemo(() => {
    return Object.values(filters).reduce((sum, arr) => sum + arr.length, 0);
  }, [filters]);

  return {
    filteredData,
    search,
    setSearch,
    filters,
    setFilter,
    clearAllFilters,
    sortColumn,
    sortDirection,
    setSort,
    activeFilterCount,
  };
}
