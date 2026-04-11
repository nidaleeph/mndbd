"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  FiMoreVertical,
  FiEdit,
  FiTrash2,
  FiCheck,
  FiChevronDown,
  FiChevronRight,
} from "react-icons/fi";
import { createPortal } from "react-dom";
import { Badge } from "@/components/ui";
import {
  useTableSearchFilterSort,
  DataTableToolbar,
  SortableHeader,
  ColumnFilterDropdown,
} from "@/features/shared/table";
import { formatManilaDateTime } from "@/lib/dates";

type PrayerWithCreator = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  createdBy: { name: string };
  createdAt: string;
};

type PrayerRowActions = {
  canEdit: boolean;
  canDelete: boolean;
  canSetStatus: boolean;
};

const PRAYER_STATUS_OPTIONS = ["pending", "prayed_for"];

function formatStatus(s: string): string {
  return s === "prayed_for" ? "Prayed for" : "Pending";
}

interface PrayerTableClientProps {
  prayers: (PrayerWithCreator & { _actions?: PrayerRowActions })[];
}

export function PrayerTableClient({ prayers }: PrayerTableClientProps) {
  const createdByOptions = useMemo(
    () => [...new Set(prayers.map((r) => r.createdBy.name).filter(Boolean))].sort(),
    [prayers]
  );

  const tableConfig = useMemo(
    () => ({
      searchKeys: ["title", "description", "createdBy.name"] as const,
      filterableColumns: {
        status: {
          accessor: (r: PrayerWithCreator) => r.status,
          options: PRAYER_STATUS_OPTIONS,
        },
        createdBy: {
          accessor: (r: PrayerWithCreator) => r.createdBy.name,
          options: createdByOptions,
        },
      },
      sortableColumns: {
        title: { accessor: (r: PrayerWithCreator) => r.title },
        status: { accessor: (r: PrayerWithCreator) => r.status },
      },
    }),
    [createdByOptions]
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
  } = useTableSearchFilterSort(prayers, tableConfig);

  const filterableColumnOptions = useMemo(
    () => ({
      status: { options: PRAYER_STATUS_OPTIONS, formatOption: formatStatus },
      createdBy: { options: createdByOptions },
    }),
    [createdByOptions]
  );
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number } | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleMarkPrayedFor = useCallback(
    (id: string) => {
      setOpenId(null);
      setLoadingId(id);
      fetch(`/api/prayers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "prayed_for" }),
      })
        .then((r) => {
          if (r.ok) router.refresh();
        })
        .finally(() => setLoadingId(null));
    },
    [router]
  );

  const handleDelete = useCallback(
    (id: string) => {
      setOpenId(null);
      if (!window.confirm("Are you sure you want to delete this prayer?")) return;
      setLoadingId(id);
      fetch(`/api/prayers/${id}`, { method: "DELETE" })
        .then((r) => {
          if (r.ok) router.refresh();
        })
        .finally(() => setLoadingId(null));
    },
    [router]
  );

  return (
    <div className="overflow-hidden rounded border border-[var(--color-border)]">
      <DataTableToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search prayers…"
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
              <th scope="col" className="w-10 px-2 py-3" aria-label="Expand" />
              <SortableHeader
                columnId="title"
                label="Title"
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                onSort={setSort}
              />
              <th scope="col" className="px-4 py-3 font-medium text-[var(--color-text-dark)]">
                <div className="flex items-center gap-1">
                  <span>Created by</span>
                  <ColumnFilterDropdown
                    columnId="createdBy"
                    columnLabel="Created by"
                    options={filterableColumnOptions.createdBy.options}
                    selectedValues={filters.createdBy ?? []}
                    onSelectionChange={setFilter}
                  />
                </div>
              </th>
              <SortableHeader
                columnId="status"
                label="Status"
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                onSort={setSort}
                filterSlot={
                  <ColumnFilterDropdown
                    columnId="status"
                    columnLabel="Status"
                    options={filterableColumnOptions.status.options}
                    selectedValues={filters.status ?? []}
                    onSelectionChange={setFilter}
                    formatOption={filterableColumnOptions.status.formatOption}
                  />
                }
              />
              <th scope="col" className="w-12 px-2 py-3" aria-label="Actions" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {filteredData.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[var(--color-text-muted)]">
                  No prayers yet. Create one to get started.
                </td>
              </tr>
            ) : (
              filteredData.map((row) => (
                <React.Fragment key={row.id}>
                  <tr className="hover:bg-[var(--color-soft-blue-bg)]/50">
                    <td className="px-2 py-3">
                      <button
                        type="button"
                        onClick={() => setExpandedId((prev) => (prev === row.id ? null : row.id))}
                        aria-expanded={expandedId === row.id}
                        aria-label={expandedId === row.id ? "Collapse details" : "Expand details"}
                        className="inline-flex items-center justify-center rounded p-1 text-[var(--color-text-dark)] hover:bg-[var(--color-soft-blue-bg)] focus:ring-2 focus:ring-[var(--color-primary)] focus:outline-none"
                      >
                        {expandedId === row.id ? (
                          <FiChevronDown className="size-4" aria-hidden />
                        ) : (
                          <FiChevronRight className="size-4" aria-hidden />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/prayers/${row.id}`}
                        className="text-[var(--color-primary)] hover:underline"
                      >
                        {row.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-dark)]">
                      {row.createdBy.name}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={row.status === "prayed_for" ? "success" : "default"}>
                        {row.status === "prayed_for" ? "Prayed for" : "Pending"}
                      </Badge>
                    </td>
                    <td className="px-2 py-3">
                      {row._actions &&
                      (row._actions.canEdit ||
                        row._actions.canDelete ||
                        row._actions.canSetStatus) ? (
                        <PrayerActionsDropdown
                          prayerId={row.id}
                          actions={row._actions}
                          isOpen={openId === row.id}
                          dropdownRect={openId === row.id ? dropdownRect : null}
                          onToggle={(btnEl) => {
                            if (openId === row.id) {
                              setOpenId(null);
                              setDropdownRect(null);
                            } else {
                              setOpenId(row.id);
                              if (btnEl) {
                                const rect = btnEl.getBoundingClientRect();
                                setDropdownRect({ top: rect.bottom + 4, left: rect.right - 160 });
                              }
                            }
                          }}
                          onMarkPrayedFor={() => handleMarkPrayedFor(row.id)}
                          onDelete={() => handleDelete(row.id)}
                          isLoading={loadingId === row.id}
                        />
                      ) : (
                        <span className="text-[var(--color-text-muted)]">—</span>
                      )}
                    </td>
                  </tr>
                  {expandedId === row.id && (
                    <tr key={`${row.id}-detail`} className="bg-[var(--color-soft-blue-bg)]/30">
                      <td colSpan={5} className="px-4 py-3">
                        <div className="rounded border border-[var(--color-border)] bg-[var(--color-card-bg)] p-4">
                          <dl className="grid gap-2 sm:grid-cols-2">
                            <div className="sm:col-span-2">
                              <dt className="text-xs font-medium text-[var(--color-text-muted)]">
                                Description
                              </dt>
                              <dd className="mt-1 text-sm text-[var(--color-text-dark)]">
                                {row.description || "—"}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-xs font-medium text-[var(--color-text-muted)]">
                                Created
                              </dt>
                              <dd className="mt-1 text-sm text-[var(--color-text-dark)]">
                                {formatManilaDateTime(row.createdAt)}
                              </dd>
                            </div>
                          </dl>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PrayerActionsDropdown({
  prayerId,
  actions,
  isOpen,
  dropdownRect,
  onToggle,
  onMarkPrayedFor,
  onDelete,
  isLoading,
}: {
  prayerId: string;
  actions: PrayerRowActions;
  isOpen: boolean;
  dropdownRect: { top: number; left: number } | null;
  onToggle: (btnEl: HTMLButtonElement | null) => void;
  onMarkPrayedFor: () => void;
  onDelete: () => void;
  isLoading: boolean;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);

  const dropdownMenu =
    isOpen &&
    dropdownRect &&
    typeof document !== "undefined" &&
    createPortal(
      <PrayerDropdownMenu
        prayerId={prayerId}
        actions={actions}
        dropdownRect={dropdownRect}
        onMarkPrayedFor={onMarkPrayedFor}
        onDelete={onDelete}
        onClose={() => onToggle(null)}
        isLoading={isLoading}
      />,
      document.body
    );

  return (
    <div className="relative inline-block">
      <button
        ref={triggerRef}
        data-prayer-trigger={prayerId}
        type="button"
        onClick={() => onToggle(triggerRef.current)}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label="Actions menu"
        className="inline-flex items-center justify-center rounded p-1.5 text-[var(--color-text-dark)] hover:bg-[var(--color-soft-blue-bg)] focus:ring-2 focus:ring-[var(--color-primary)] focus:outline-none disabled:opacity-50"
        disabled={isLoading}
      >
        <FiMoreVertical className="size-5" aria-hidden />
      </button>
      {dropdownMenu}
    </div>
  );
}

function PrayerDropdownMenu({
  prayerId,
  actions,
  dropdownRect,
  onMarkPrayedFor,
  onDelete,
  onClose,
  isLoading,
}: {
  prayerId: string;
  actions: PrayerRowActions;
  dropdownRect: { top: number; left: number };
  onMarkPrayedFor: () => void;
  onDelete: () => void;
  onClose: () => void;
  isLoading: boolean;
}) {
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Element;
      if (
        !target.closest("[data-actions-dropdown]") &&
        !target.closest(`[data-prayer-trigger="${prayerId}"]`)
      ) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [prayerId, onClose]);

  return (
    <ul
      role="menu"
      data-actions-dropdown
      className="fixed z-50 min-w-[160px] rounded border border-[var(--color-border)] bg-[var(--color-card-bg)] py-1 shadow-lg"
      style={{ top: dropdownRect.top, left: dropdownRect.left }}
    >
      {actions.canEdit && (
        <li role="none">
          <Link
            href={`/dashboard/prayers/${prayerId}/edit`}
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-[var(--color-text-dark)] hover:bg-[var(--color-soft-blue-bg)]"
            onClick={onClose}
          >
            <FiEdit className="size-4 shrink-0" aria-hidden />
            Edit
          </Link>
        </li>
      )}
      {actions.canSetStatus && (
        <li role="none">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onMarkPrayedFor();
              onClose();
            }}
            disabled={isLoading}
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-[var(--color-text-dark)] hover:bg-[var(--color-soft-blue-bg)] disabled:opacity-50"
          >
            <FiCheck className="size-4 shrink-0" aria-hidden />
            Mark as prayed for
          </button>
        </li>
      )}
      {actions.canDelete && (
        <li role="none">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onDelete();
              onClose();
            }}
            disabled={isLoading}
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-[var(--color-text-dark)] hover:bg-[var(--color-soft-blue-bg)] disabled:opacity-50"
          >
            <FiTrash2 className="size-4 shrink-0" aria-hidden />
            Delete
          </button>
        </li>
      )}
    </ul>
  );
}
