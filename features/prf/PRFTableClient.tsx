"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ExpandableTable } from "@/features/shared/ExpandableTable";
import { FormActionsCell, type RowActions } from "@/features/shared/FormActionsCell";
import { Badge } from "@/components/ui";
import { useTableSearchFilterSort, DataTableToolbar } from "@/features/shared/table";
import { formatManilaDate } from "@/lib/dates";

type PRFWithRelations = {
  id: string;
  purpose: string;
  requestDate: Date;
  amountRequested: number;
  justification: string;
  status: string;
  ministry: { name: string };
  createdBy: { name: string };
  _actions?: RowActions;
};

const PRF_STATUS_OPTIONS = ["draft", "pending", "approved", "rejected"];

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

interface PRFTableClientProps {
  prfs: PRFWithRelations[];
}

export function PRFTableClient({ prfs }: PRFTableClientProps) {
  const ministryOptions = useMemo(
    () => [...new Set(prfs.map((r) => r.ministry.name).filter(Boolean))].sort(),
    [prfs]
  );
  const createdByOptions = useMemo(
    () => [...new Set(prfs.map((r) => r.createdBy.name).filter(Boolean))].sort(),
    [prfs]
  );

  const tableConfig = useMemo(
    () => ({
      searchKeys: ["purpose", "ministry.name", "justification", "createdBy.name"] as const,
      filterableColumns: {
        ministry: {
          accessor: (r: PRFWithRelations) => r.ministry.name,
          options: ministryOptions,
        },
        status: {
          accessor: (r: PRFWithRelations) => r.status,
          options: PRF_STATUS_OPTIONS,
        },
        createdBy: {
          accessor: (r: PRFWithRelations) => r.createdBy.name,
          options: createdByOptions,
        },
      },
      sortableColumns: {
        purpose: { accessor: (r: PRFWithRelations) => r.purpose },
        amount: { accessor: (r: PRFWithRelations) => Number(r.amountRequested) },
        date: { accessor: (r: PRFWithRelations) => new Date(r.requestDate).getTime() },
        status: { accessor: (r: PRFWithRelations) => r.status },
      },
    }),
    [ministryOptions, createdByOptions]
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
  } = useTableSearchFilterSort(prfs, tableConfig);

  const filterableColumnOptions = useMemo(
    () => ({
      ministry: { options: ministryOptions },
      status: { options: PRF_STATUS_OPTIONS, formatOption: capitalize },
      createdBy: { options: createdByOptions },
    }),
    [ministryOptions, createdByOptions]
  );
  const columns = [
    {
      id: "purpose",
      header: "Purpose",
      cell: (row: PRFWithRelations) => (
        <Link
          href={`/dashboard/forms/prf/${row.id}`}
          className="text-[var(--color-primary)] hover:underline"
        >
          {row.purpose.length > 50 ? `${row.purpose.slice(0, 50)}…` : row.purpose}
        </Link>
      ),
    },
    {
      id: "ministry",
      header: "Ministry",
      cell: (row: PRFWithRelations) => row.ministry.name,
    },
    {
      id: "amount",
      header: "Amount",
      cell: (row: PRFWithRelations) =>
        new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
        }).format(Number(row.amountRequested)),
    },
    {
      id: "date",
      header: "Date",
      cell: (row: PRFWithRelations) => formatManilaDate(row.requestDate),
    },
    {
      id: "status",
      header: "Status",
      cell: (row: PRFWithRelations) => (
        <Badge
          variant={
            row.status === "approved"
              ? "success"
              : row.status === "rejected"
                ? "danger"
                : row.status === "pending"
                  ? "warning"
                  : row.status === "draft"
                    ? "info"
                    : "default"
          }
        >
          {row.status}
        </Badge>
      ),
    },
    {
      id: "createdBy",
      header: "Created by",
      cell: (row: PRFWithRelations) => row.createdBy.name,
    },
    {
      id: "actions",
      header: "Actions",
      cell: (row: PRFWithRelations) =>
        row._actions ? (
          <FormActionsCell
            entityType="prf"
            entityId={row.id}
            editHref={`/dashboard/forms/prf/${row.id}/edit`}
            actions={row._actions}
          />
        ) : (
          <span className="text-[var(--color-text-muted)]">—</span>
        ),
    },
  ];

  function renderDetail(row: PRFWithRelations) {
    return (
      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-sm font-medium text-[var(--color-text-muted)]">Ministry</dt>
          <dd className="mt-0.5">{row.ministry.name}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-[var(--color-text-muted)]">Request date</dt>
          <dd className="mt-0.5">{formatManilaDate(row.requestDate)}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-[var(--color-text-muted)]">Amount requested</dt>
          <dd className="mt-0.5">
            {new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: "USD",
            }).format(Number(row.amountRequested))}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-sm font-medium text-[var(--color-text-muted)]">Purpose</dt>
          <dd className="mt-0.5">{row.purpose}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-sm font-medium text-[var(--color-text-muted)]">Justification</dt>
          <dd className="mt-0.5">{row.justification}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-[var(--color-text-muted)]">Created by</dt>
          <dd className="mt-0.5">{row.createdBy.name}</dd>
        </div>
      </dl>
    );
  }

  return (
    <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--color-border)]">
      <DataTableToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search PRFs…"
        activeFilterCount={activeFilterCount}
        onClearFilters={clearAllFilters}
      >
        {activeFilterCount > 0 && (
          <span className="text-sm text-[var(--color-text-muted)]">
            {activeFilterCount} filter{activeFilterCount !== 1 ? "s" : ""} active
          </span>
        )}
      </DataTableToolbar>
      <ExpandableTable
        columns={columns}
        data={filteredData}
        keyExtractor={(row) => row.id}
        renderDetail={renderDetail}
        emptyMessage="No PRFs yet. Create one to get started."
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSort={setSort}
        sortableColumns={["purpose", "amount", "date", "status"]}
        filters={filters}
        onFilterChange={setFilter}
        filterableColumns={{
          ministry: filterableColumnOptions.ministry,
          status: filterableColumnOptions.status,
          createdBy: filterableColumnOptions.createdBy,
        }}
        embedded
      />
    </div>
  );
}
