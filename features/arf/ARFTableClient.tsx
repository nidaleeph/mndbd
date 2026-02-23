"use client";

import Link from "next/link";
import { ExpandableTable } from "@/features/shared/ExpandableTable";
import { FormActionsCell, type RowActions } from "@/features/shared/FormActionsCell";
import { Badge } from "@/components/ui";

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

interface ARFTableClientProps {
  arfs: ARFWithRelations[];
}

export function ARFTableClient({ arfs }: ARFTableClientProps) {
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
    <ExpandableTable
      columns={columns}
      data={arfs}
      keyExtractor={(row) => row.id}
      renderDetail={renderDetail}
      emptyMessage="No ARFs yet. Create one to get started."
    />
  );
}
