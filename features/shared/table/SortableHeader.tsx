"use client";

import { FiChevronUp, FiChevronDown } from "react-icons/fi";

export type SortDirection = "asc" | "desc" | null;

interface SortableHeaderProps {
  columnId: string;
  label: string;
  sortColumn: string | null;
  sortDirection: SortDirection;
  onSort: (columnId: string) => void;
  /** Optional filter dropdown to render next to the label */
  filterSlot?: React.ReactNode;
}

/**
 * Clickable column header with sort indicator.
 * Toggles asc -> desc -> null (clear sort) on each click.
 */
export function SortableHeader({
  columnId,
  label,
  sortColumn,
  sortDirection,
  onSort,
  filterSlot,
}: SortableHeaderProps) {
  const isActive = sortColumn === columnId;

  const handleClick = () => {
    onSort(columnId);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSort(columnId);
    }
  };

  return (
    <th
      scope="col"
      aria-sort={isActive ? (sortDirection === "asc" ? "ascending" : "descending") : undefined}
      className="px-4 py-3 font-medium text-[var(--color-text-dark)]"
    >
      <div className="flex min-w-0 items-center gap-1">
        <button
          type="button"
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          aria-label={
            isActive
              ? `Sort by ${label} ${sortDirection === "asc" ? "ascending" : "descending"}. Click to change.`
              : `Sort by ${label}`
          }
          className="flex items-center gap-1 rounded text-left hover:bg-[var(--color-soft-blue-bg)] focus:ring-2 focus:ring-[var(--color-primary)] focus:outline-none"
        >
          <span>{label}</span>
          {isActive && sortDirection ? (
            sortDirection === "asc" ? (
              <FiChevronUp className="size-4 shrink-0" aria-hidden />
            ) : (
              <FiChevronDown className="size-4 shrink-0" aria-hidden />
            )
          ) : (
            <span className="inline-block w-4" aria-hidden />
          )}
        </button>
        {filterSlot}
      </div>
    </th>
  );
}
