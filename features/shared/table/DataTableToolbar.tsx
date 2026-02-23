"use client";

import { SearchBar } from "./SearchBar";

interface DataTableToolbarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  /** Optional: render filter chips or other content */
  children?: React.ReactNode;
  /** When > 0, shows "Clear filters" button at top right */
  activeFilterCount?: number;
  /** Called when user clicks "Clear filters" */
  onClearFilters?: () => void;
}

/**
 * Toolbar above table with search input and optional filter summary.
 */
export function DataTableToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search…",
  children,
  activeFilterCount = 0,
  onClearFilters,
}: DataTableToolbarProps) {
  const showClearFilters = activeFilterCount > 0 && typeof onClearFilters === "function";

  const handleClearFilters = () => {
    onClearFilters?.();
  };

  const handleClearFiltersKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClearFilters();
    }
  };

  return (
    <div className="flex flex-col gap-3 border-b border-[var(--color-border)] bg-[var(--color-soft-blue-bg)]/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1 sm:max-w-sm">
        <SearchBar value={searchValue} onChange={onSearchChange} placeholder={searchPlaceholder} />
      </div>
      <div className="flex items-center gap-2">
        {children}
        {showClearFilters && (
          <button
            type="button"
            onClick={handleClearFilters}
            onKeyDown={handleClearFiltersKeyDown}
            className="rounded px-3 py-1.5 text-sm text-[var(--color-primary)] hover:bg-[var(--color-soft-blue-bg)] focus:ring-2 focus:ring-[var(--color-primary)] focus:outline-none"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
