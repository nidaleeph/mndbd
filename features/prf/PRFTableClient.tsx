"use client";

import Link from "next/link";
import { ExpandableTable } from "@/features/shared/ExpandableTable";
import { FormActionsCell, type RowActions } from "@/features/shared/FormActionsCell";
import { Badge } from "@/components/ui";

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

interface PRFTableClientProps {
  prfs: PRFWithRelations[];
}

export function PRFTableClient({ prfs }: PRFTableClientProps) {
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
      cell: (row: PRFWithRelations) => new Date(row.requestDate).toLocaleDateString(),
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
          <dd className="mt-0.5">{new Date(row.requestDate).toLocaleDateString()}</dd>
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
    <ExpandableTable
      columns={columns}
      data={prfs}
      keyExtractor={(row) => row.id}
      renderDetail={renderDetail}
      emptyMessage="No PRFs yet. Create one to get started."
    />
  );
}
