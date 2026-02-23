"use client";

import type { ReactNode } from "react";
import { Fragment, useState, useCallback } from "react";
import { FiChevronRight, FiChevronDown } from "react-icons/fi";

export interface ExpandableTableColumn<T> {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
}

export interface ExpandableTableProps<T> {
  columns: ExpandableTableColumn<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  renderDetail: (row: T) => ReactNode;
  emptyMessage?: string;
  className?: string;
}

/**
 * Table with expand/collapse per row. Clicking the expand icon or row toggles
 * a full-width detail section below the row.
 */
export function ExpandableTable<T>({
  columns,
  data,
  keyExtractor,
  renderDetail,
  emptyMessage = "No data",
  className = "",
}: ExpandableTableProps<T>) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, id: string) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggleExpand(id);
      }
    },
    [toggleExpand]
  );

  return (
    <div
      className={`overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)] ${className}`}
    >
      <table className="w-full min-w-[400px] text-left text-sm">
        <thead className="border-b border-[var(--color-border)] bg-[var(--color-soft-blue-bg)]">
          <tr>
            <th scope="col" className="w-10 px-2 py-3" aria-label="Expand" />
            {columns.map((col) => (
              <th
                key={col.id}
                scope="col"
                className="px-4 py-3 font-medium text-[var(--color-text-dark)]"
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length + 1}
                className="px-4 py-8 text-center text-[var(--color-text-muted)]"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row) => {
              const id = keyExtractor(row);
              const isExpanded = expandedId === id;
              return (
                <Fragment key={id}>
                  <tr key={id} className="hover:bg-[var(--color-soft-blue-bg)]/50">
                    <td className="w-10 px-2 py-3">
                      <button
                        type="button"
                        onClick={() => toggleExpand(id)}
                        onKeyDown={(e) => handleKeyDown(e, id)}
                        aria-expanded={isExpanded}
                        aria-label={isExpanded ? "Collapse row" : "Expand row"}
                        className="rounded p-1 text-[var(--color-text-dark)] hover:bg-[var(--color-soft-blue-bg)] focus:ring-2 focus:ring-[var(--color-primary)] focus:outline-none"
                      >
                        {isExpanded ? (
                          <FiChevronDown className="size-5" aria-hidden />
                        ) : (
                          <FiChevronRight className="size-5" aria-hidden />
                        )}
                      </button>
                    </td>
                    {columns.map((col) => (
                      <td key={col.id} className="px-4 py-3 text-[var(--color-text-dark)]">
                        {col.cell(row)}
                      </td>
                    ))}
                  </tr>
                  {isExpanded && (
                    <tr key={`${id}-detail`}>
                      <td
                        colSpan={columns.length + 1}
                        className="bg-[var(--color-soft-blue-bg)]/30 px-4 py-4"
                      >
                        <div className="rounded border border-[var(--color-border)] bg-[var(--color-card-bg)] p-4 text-[var(--color-text-dark)]">
                          {renderDetail(row)}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
