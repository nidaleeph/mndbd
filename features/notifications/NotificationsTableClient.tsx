"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui";
import {
  useTableSearchFilterSort,
  DataTableToolbar,
  SortableHeader,
  ColumnFilterDropdown,
} from "@/features/shared/table";
import { MarkReadButton } from "@/app/(dashboard)/dashboard/notifications/MarkReadButton";
import { formatManilaDateTime } from "@/lib/dates";

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: Date | string;
};

function formatRead(read: boolean): string {
  return read ? "Read" : "Unread";
}

const READ_OPTIONS = ["true", "false"] as const;

interface NotificationsTableClientProps {
  notifications: NotificationRow[];
}

export function NotificationsTableClient({ notifications }: NotificationsTableClientProps) {
  const typeOptions = useMemo(
    () => [...new Set(notifications.map((r) => r.type).filter(Boolean))].sort(),
    [notifications]
  );

  const tableConfig = useMemo(
    () => ({
      searchKeys: ["type", "title", "body"] as const,
      filterableColumns: {
        type: {
          accessor: (r: NotificationRow) => r.type,
          options: typeOptions,
        },
        read: {
          accessor: (r: NotificationRow) => String(r.read),
          options: [...READ_OPTIONS],
        },
      },
      sortableColumns: {
        title: { accessor: (r: NotificationRow) => r.title },
        createdAt: {
          accessor: (r: NotificationRow) =>
            new Date(r.createdAt instanceof Date ? r.createdAt : r.createdAt).getTime(),
        },
      },
    }),
    [typeOptions]
  );

  const {
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
  } = useTableSearchFilterSort(notifications, tableConfig);

  const filterableColumnOptions = useMemo(
    () => ({
      type: { options: typeOptions },
      read: {
        options: [...READ_OPTIONS],
        formatOption: (v: string) => (v === "true" ? "Read" : "Unread"),
      },
    }),
    [typeOptions]
  );

  return (
    <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--color-border)]">
      <DataTableToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search notifications…"
        activeFilterCount={activeFilterCount}
        onClearFilters={clearAllFilters}
      >
        {activeFilterCount > 0 && (
          <span className="text-sm text-[var(--color-text-muted)]">
            {activeFilterCount} filter{activeFilterCount !== 1 ? "s" : ""} active
          </span>
        )}
      </DataTableToolbar>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[400px] text-left text-sm">
          <thead className="border-b border-[var(--color-border)] bg-[var(--color-soft-blue-bg)]">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium text-[var(--color-text-dark)]">
                <div className="flex items-center gap-1">
                  <span>Type</span>
                  <ColumnFilterDropdown
                    columnId="type"
                    columnLabel="Type"
                    options={filterableColumnOptions.type.options}
                    selectedValues={filters.type ?? []}
                    onSelectionChange={setFilter}
                  />
                </div>
              </th>
              <SortableHeader
                columnId="title"
                label="Title"
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                onSort={setSort}
              />
              <th scope="col" className="px-4 py-3 font-medium text-[var(--color-text-dark)]">
                <div className="flex items-center gap-1">
                  <span>Read</span>
                  <ColumnFilterDropdown
                    columnId="read"
                    columnLabel="Read"
                    options={filterableColumnOptions.read.options}
                    selectedValues={filters.read ?? []}
                    onSelectionChange={setFilter}
                    formatOption={filterableColumnOptions.read.formatOption}
                  />
                </div>
              </th>
              <SortableHeader
                columnId="createdAt"
                label="Date"
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                onSort={setSort}
              />
              <th scope="col" className="w-24 px-4 py-3" aria-label="Actions" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {filteredData.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[var(--color-text-muted)]">
                  No notifications yet
                </td>
              </tr>
            ) : (
              filteredData.map((row) => (
                <tr
                  key={row.id}
                  className={`hover:bg-[var(--color-soft-blue-bg)]/50 ${!row.read ? "bg-[var(--color-soft-blue-bg)]/30" : ""}`}
                >
                  <td className="px-4 py-3 text-[var(--color-text-dark)]">{row.type}</td>
                  <td className="px-4 py-3">
                    {row.link ? (
                      <Link href={row.link} className="text-[var(--color-primary)] hover:underline">
                        {row.title}
                      </Link>
                    ) : (
                      <span className="text-[var(--color-text-dark)]">{row.title}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={row.read ? "default" : "info"}>{formatRead(row.read)}</Badge>
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-dark)]">
                    {formatManilaDateTime(
                      row.createdAt instanceof Date ? row.createdAt : row.createdAt
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {!row.read && <MarkReadButton notificationId={row.id} />}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
