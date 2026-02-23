"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ExpandableTable } from "@/features/shared/ExpandableTable";
import { FormActionsCell, type RowActions } from "@/features/shared/FormActionsCell";
import { Badge } from "@/components/ui";
import { useTableSearchFilterSort, DataTableToolbar } from "@/features/shared/table";

type ARFWithRelations = {
  id: string;
  eventName: string;
  requestedDate: Date;
  what: string;
  when: string;
  where: string;
  why: string;
  justification: string;
  status: string;
  ministry: { name: string };
  createdBy: { name: string };
  _actions?: RowActions;
};

const ARF_STATUS_OPTIONS = ["draft", "pending", "approved", "rejected"];

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

interface ARFTableClientProps {
  arfs: ARFWithRelations[];
}

export function ARFTableClient({ arfs }: ARFTableClientProps) {
  const ministryOptions = useMemo(
    () => [...new Set(arfs.map((r) => r.ministry.name).filter(Boolean))].sort(),
    [arfs]
  );
  const createdByOptions = useMemo(
    () => [...new Set(arfs.map((r) => r.createdBy.name).filter(Boolean))].sort(),
    [arfs]
  );

  const tableConfig = useMemo(
    () => ({
      searchKeys: ["eventName", "ministry.name", "what", "where", "createdBy.name"] as const,
      filterableColumns: {
        ministry: {
          accessor: (r: ARFWithRelations) => r.ministry.name,
          options: ministryOptions,
        },
        status: {
          accessor: (r: ARFWithRelations) => r.status,
          options: ARF_STATUS_OPTIONS,
        },
        createdBy: {
          accessor: (r: ARFWithRelations) => r.createdBy.name,
          options: createdByOptions,
        },
      },
      sortableColumns: {
        eventName: { accessor: (r: ARFWithRelations) => r.eventName },
        date: { accessor: (r: ARFWithRelations) => new Date(r.requestedDate).getTime() },
        status: { accessor: (r: ARFWithRelations) => r.status },
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
  } = useTableSearchFilterSort(arfs, tableConfig);

  const filterableColumnOptions = useMemo(
    () => ({
      ministry: { options: ministryOptions },
      status: { options: ARF_STATUS_OPTIONS, formatOption: capitalize },
      createdBy: { options: createdByOptions },
    }),
    [ministryOptions, createdByOptions]
  );
  const columns = [
    {
      id: "eventName",
      header: "Event",
      cell: (row: ARFWithRelations) => (
        <Link
          href={`/dashboard/forms/arf/${row.id}`}
          className="text-[var(--color-primary)] hover:underline"
        >
          {row.eventName}
        </Link>
      ),
    },
    {
      id: "ministry",
      header: "Ministry",
      cell: (row: ARFWithRelations) => row.ministry.name,
    },
    {
      id: "date",
      header: "Date",
      cell: (row: ARFWithRelations) => new Date(row.requestedDate).toLocaleDateString(),
    },
    {
      id: "status",
      header: "Status",
      cell: (row: ARFWithRelations) => (
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
      cell: (row: ARFWithRelations) => row.createdBy.name,
    },
    {
      id: "actions",
      header: "Actions",
      cell: (row: ARFWithRelations) =>
        row._actions ? (
          <FormActionsCell
            entityType="arf"
            entityId={row.id}
            editHref={`/dashboard/forms/arf/${row.id}/edit`}
            actions={row._actions}
          />
        ) : (
          <span className="text-[var(--color-text-muted)]">—</span>
        ),
    },
  ];

  function renderDetail(row: ARFWithRelations) {
    return (
      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-sm font-medium text-[var(--color-text-muted)]">Ministry</dt>
          <dd className="mt-0.5">{row.ministry.name}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-[var(--color-text-muted)]">Requested date</dt>
          <dd className="mt-0.5">{new Date(row.requestedDate).toLocaleDateString()}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-[var(--color-text-muted)]">What</dt>
          <dd className="mt-0.5">{row.what}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-[var(--color-text-muted)]">When</dt>
          <dd className="mt-0.5">{row.when}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-[var(--color-text-muted)]">Where</dt>
          <dd className="mt-0.5">{row.where}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-[var(--color-text-muted)]">Why</dt>
          <dd className="mt-0.5">{row.why}</dd>
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
        searchPlaceholder="Search ARFs…"
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
        emptyMessage="No ARFs yet. Create one to get started."
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSort={setSort}
        sortableColumns={["eventName", "date", "status"]}
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
