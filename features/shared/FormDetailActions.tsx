"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { FiEdit, FiTrash2, FiSend, FiX } from "react-icons/fi";
import { Button } from "@/components/ui";

interface FormDetailActionsProps {
  entityType: "arf" | "prf" | "lineup";
  entityId: string;
  editHref: string;
  canEdit: boolean;
  canDelete: boolean;
  canChangeStatus: boolean;
  statusActions: Array<"submit" | "approve" | "reject">;
}

/**
 * Renders Edit, Delete, and status-change buttons for a detail page.
 * Used on ARF, PRF, and Lineup detail pages.
 */
export function FormDetailActions({
  entityType,
  entityId,
  editHref,
  canEdit,
  canDelete,
  canChangeStatus,
  statusActions,
}: FormDetailActionsProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);

  const apiBase =
    entityType === "lineup" ? `/api/lineup/${entityId}` : `/api/forms/${entityType}/${entityId}`;

  const handleDelete = useCallback(() => {
    if (!window.confirm("Are you sure you want to delete this?")) return;
    setDeleting(true);
    fetch(apiBase, { method: "DELETE" })
      .then((r) => {
        if (!r.ok) throw new Error("Delete failed");
        router.push(
          entityType === "lineup" ? "/dashboard/lineup" : `/dashboard/forms/${entityType}`
        );
        router.refresh();
      })
      .catch(() => setDeleting(false))
      .finally(() => setDeleting(false));
  }, [apiBase, entityType, router]);

  const getStatusValue = useCallback(
    (action: "submit" | "approve" | "reject") => {
      if (action === "submit") return entityType === "lineup" ? "Pending Approval" : "pending";
      if (action === "approve") return entityType === "lineup" ? "Approved" : "approved";
      if (action === "reject") return "rejected";
      return "";
    },
    [entityType]
  );

  const handleStatusChange = useCallback(
    (action: "submit" | "approve" | "reject") => {
      setStatusLoading(true);
      fetch(apiBase, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: getStatusValue(action) }),
      })
        .then((r) => {
          if (!r.ok) throw new Error("Status update failed");
          router.refresh();
        })
        .catch(() => {})
        .finally(() => setStatusLoading(false));
    },
    [apiBase, router, getStatusValue]
  );

  const getStatusLabel = (action: "submit" | "approve" | "reject") => {
    if (action === "submit") return "Submit for approval";
    if (action === "approve") return "Approve";
    if (action === "reject") return "Reject";
    return "";
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canEdit && (
        <Link
          href={editHref}
          className="inline-flex items-center justify-center gap-2 rounded-[var(--radius)] border-2 border-[var(--color-primary)] px-4 py-2 font-medium text-[var(--color-primary)] hover:bg-[var(--color-soft-blue-bg)] focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 focus:outline-none"
        >
          <FiEdit className="size-4" aria-hidden />
          Edit
        </Link>
      )}
      {canDelete && (
        <Button
          variant="outline"
          icon={<FiTrash2 className="size-4" aria-hidden />}
          onClick={handleDelete}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleDelete();
            }
          }}
          disabled={deleting}
        >
          Delete
        </Button>
      )}
      {canChangeStatus &&
        statusActions.map((action) => (
          <Button
            key={action}
            variant={action === "reject" ? "danger" : "primary"}
            icon={
              action === "reject" ? (
                <FiX className="size-4" aria-hidden />
              ) : (
                <FiSend className="size-4" aria-hidden />
              )
            }
            onClick={() => handleStatusChange(action)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleStatusChange(action);
              }
            }}
            disabled={statusLoading}
          >
            {getStatusLabel(action)}
          </Button>
        ))}
    </div>
  );
}
