"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  useTableSearchFilterSort,
  DataTableToolbar,
  SortableHeader,
  ColumnFilterDropdown,
} from "@/features/shared/table";

interface UserRow {
  id: string;
  name: string;
  email: string;
  ministry: { name: string } | null;
  userMinistries?: { ministry: { name: string } }[];
  role: { name: string };
  status: string;
}

function getMinistryNames(row: UserRow): string[] {
  const names: string[] = [];
  if (row.ministry?.name) names.push(row.ministry.name);
  row.userMinistries?.forEach((um) => {
    if (um.ministry?.name && !names.includes(um.ministry.name)) {
      names.push(um.ministry.name);
    }
  });
  return names;
}

interface UsersTableClientProps {
  users: UserRow[];
  emptyMessage?: string;
}

/**
 * Client component for users table - renders Link in name column.
 * Avoids passing cell functions from server to client.
 */
export function UsersTableClient({
  users,
  emptyMessage = "No users found.",
}: UsersTableClientProps) {
  const ministryOptions = useMemo(() => {
    const set = new Set<string>();
    users.forEach((u) => getMinistryNames(u).forEach((n) => set.add(n)));
    return [...set].sort();
  }, [users]);
  const roleOptions = useMemo(
    () => [...new Set(users.map((r) => r.role.name).filter(Boolean))].sort(),
    [users]
  );
  const statusOptions = useMemo(
    () => [...new Set(users.map((r) => r.status).filter(Boolean))].sort(),
    [users]
  );

  const tableConfig = useMemo(
    () => ({
      searchKeys: ["name", "email", "role.name", (r: UserRow) => getMinistryNames(r).join(" ")],
      filterableColumns: {
        ministries: {
          accessor: (r: UserRow) => getMinistryNames(r),
          options: ministryOptions,
        },
        role: {
          accessor: (r: UserRow) => r.role.name,
          options: roleOptions,
        },
        status: {
          accessor: (r: UserRow) => r.status,
          options: statusOptions,
        },
      },
      sortableColumns: {
        name: { accessor: (r: UserRow) => r.name },
        email: { accessor: (r: UserRow) => r.email },
        role: { accessor: (r: UserRow) => r.role.name },
      },
    }),
    [ministryOptions, roleOptions, statusOptions]
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
  } = useTableSearchFilterSort(users, tableConfig);

  const filterableColumnOptions = useMemo(
    () => ({
      ministries: { options: ministryOptions },
      role: { options: roleOptions },
      status: { options: statusOptions },
    }),
    [ministryOptions, roleOptions, statusOptions]
  );

  return (
    <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--color-border)]">
      <DataTableToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search users…"
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
              <SortableHeader
                columnId="name"
                label="Name"
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                onSort={setSort}
              />
              <SortableHeader
                columnId="email"
                label="Email"
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                onSort={setSort}
              />
              <th scope="col" className="px-4 py-3 font-medium text-[var(--color-text-dark)]">
                <div className="flex items-center gap-1">
                  <span>Ministries</span>
                  <ColumnFilterDropdown
                    columnId="ministries"
                    columnLabel="Ministries"
                    options={filterableColumnOptions.ministries.options}
                    selectedValues={filters.ministries ?? []}
                    onSelectionChange={setFilter}
                  />
                </div>
              </th>
              <SortableHeader
                columnId="role"
                label="Role"
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                onSort={setSort}
                filterSlot={
                  <ColumnFilterDropdown
                    columnId="role"
                    columnLabel="Role"
                    options={filterableColumnOptions.role.options}
                    selectedValues={filters.role ?? []}
                    onSelectionChange={setFilter}
                  />
                }
              />
              <th scope="col" className="px-4 py-3 font-medium text-[var(--color-text-dark)]">
                <div className="flex items-center gap-1">
                  <span>Status</span>
                  <ColumnFilterDropdown
                    columnId="status"
                    columnLabel="Status"
                    options={filterableColumnOptions.status.options}
                    selectedValues={filters.status ?? []}
                    onSelectionChange={setFilter}
                  />
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {filteredData.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[var(--color-text-muted)]">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              filteredData.map((row) => (
                <tr key={row.id} className="hover:bg-[var(--color-soft-blue-bg)]/50">
                  <td className="px-4 py-3 text-[var(--color-text-dark)]">
                    <Link
                      href={`/dashboard/users/${row.id}`}
                      className="text-[var(--color-primary)] hover:underline"
                    >
                      {row.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-dark)]">{row.email}</td>
                  <td className="px-4 py-3 text-[var(--color-text-dark)]">
                    {[
                      ...(row.ministry ? [row.ministry.name] : []),
                      ...(row.userMinistries?.map((um) => um.ministry.name).filter(Boolean) ?? []),
                    ]
                      .filter((v, i, a) => a.indexOf(v) === i)
                      .join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-dark)]">{row.role.name}</td>
                  <td className="px-4 py-3 text-[var(--color-text-dark)]">{row.status}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
