"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { FiMoreVertical, FiEdit, FiTrash2, FiSend, FiX } from "react-icons/fi";

/** Actions available for a form/lineup row. Computed on server per row. */
export interface RowActions {
  canEdit: boolean;
  canDelete: boolean;
  canChangeStatus: boolean;
  /** For ARF/PRF: "submit" | "approve" | "reject". For Lineup: "submit" | "approve" */
  statusAction?: "submit" | "approve" | "reject";
  /** When pending, show both approve and reject */
  statusActions?: Array<"submit" | "approve" | "reject">;
}

interface FormActionsCellProps {
  entityType: "arf" | "prf" | "lineup";
  entityId: string;
  editHref: string;
  actions: RowActions;
  onDeleted?: () => void;
}

/**
 * Renders a "..." menu trigger that opens a vertical dropdown with Edit, Delete,
 * and status-change options. Respects role-based permissions passed via actions.
 */
export function FormActionsCell({
  entityType,
  entityId,
  editHref,
  actions,
  onDeleted,
}: FormActionsCellProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const ref = useRef<HTMLDivElement>(null);

  const apiBase =
    entityType === "lineup" ? `/api/lineup/${entityId}` : `/api/forms/${entityType}/${entityId}`;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (ref.current?.contains(target)) return;
      if ((target as Element).closest?.("[data-actions-dropdown]")) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (open && triggerRef.current && typeof document !== "undefined") {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownRect({
        top: rect.bottom + 4,
        left: rect.right - 180,
      });
    } else {
      setDropdownRect(null);
    }
  }, [open]);

  const handleEdit = useCallback(() => {
    setOpen(false);
    router.push(editHref);
  }, [editHref, router]);

  const handleDelete = useCallback(() => {
    setOpen(false);
    if (!window.confirm("Are you sure you want to delete this?")) return;
    setDeleting(true);
    fetch(apiBase, { method: "DELETE" })
      .then((r) => {
        if (!r.ok) throw new Error("Delete failed");
        onDeleted?.();
        router.refresh();
      })
      .catch(() => setDeleting(false))
      .finally(() => setDeleting(false));
  }, [apiBase, onDeleted, router]);

  const handleStatusChange = useCallback(
    (newStatus: string) => {
      setOpen(false);
      setStatusLoading(true);
      fetch(apiBase, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
        .then((r) => {
          if (!r.ok) throw new Error("Status update failed");
          router.refresh();
        })
        .catch(() => {})
        .finally(() => setStatusLoading(false));
    },
    [apiBase, router]
  );

  const getStatusLabel = (action: "submit" | "approve" | "reject") => {
    if (action === "submit") return "Submit for approval";
    if (action === "approve") return "Approve";
    if (action === "reject") return "Reject";
    return "";
  };

  const getStatusValue = (action: "submit" | "approve" | "reject") => {
    if (action === "submit") return entityType === "lineup" ? "Pending Approval" : "pending";
    if (action === "approve") return entityType === "lineup" ? "Approved" : "approved";
    if (action === "reject") return "rejected";
    return "";
  };

  const actionsToShow =
    actions.statusActions ?? (actions.statusAction ? [actions.statusAction] : []);

  if (!actions.canEdit && !actions.canDelete && !actions.canChangeStatus) {
    return <span className="text-[var(--color-text-muted)]">—</span>;
  }

  const isLoading = deleting || statusLoading;

  const dropdownMenu =
    open &&
    dropdownRect &&
    typeof document !== "undefined" &&
    createPortal(
      <ul
        role="menu"
        data-actions-dropdown
        className="fixed z-50 min-w-[180px] rounded border border-[var(--color-border)] bg-[var(--color-card-bg)] py-1 shadow-lg"
        style={{ top: dropdownRect.top, left: dropdownRect.left }}
      >
        {actions.canEdit && (
          <li role="none">
            <button
              type="button"
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation();
                handleEdit();
              }}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-[var(--color-text-dark)] hover:bg-[var(--color-soft-blue-bg)]"
            >
              <FiEdit className="size-4 shrink-0" aria-hidden />
              Edit
            </button>
          </li>
        )}
        {actions.canDelete && (
          <li role="none">
            <button
              type="button"
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete();
              }}
              disabled={deleting}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-[var(--color-text-dark)] hover:bg-[var(--color-soft-blue-bg)] disabled:opacity-50"
            >
              <FiTrash2 className="size-4 shrink-0" aria-hidden />
              Delete
            </button>
          </li>
        )}
        {actions.canChangeStatus &&
          actionsToShow.map((action) => (
            <li key={action} role="none">
              <button
                type="button"
                role="menuitem"
                onClick={(e) => {
                  e.stopPropagation();
                  handleStatusChange(getStatusValue(action));
                }}
                disabled={statusLoading}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-[var(--color-text-dark)] hover:bg-[var(--color-soft-blue-bg)] disabled:opacity-50"
              >
                {action === "reject" ? (
                  <FiX className="size-4 shrink-0" aria-hidden />
                ) : (
                  <FiSend className="size-4 shrink-0" aria-hidden />
                )}
                {getStatusLabel(action)}
              </button>
            </li>
          ))}
      </ul>,
      document.body
    );

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        aria-haspopup="true"
        aria-expanded={open}
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
