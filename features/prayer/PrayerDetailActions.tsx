"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FiEdit, FiTrash2, FiCheck } from "react-icons/fi";

interface PrayerDetailActionsProps {
  prayerId: string;
  canEdit: boolean;
  canDelete: boolean;
  canSetStatus: boolean;
}

export function PrayerDetailActions({
  prayerId,
  canEdit,
  canDelete,
  canSetStatus,
}: PrayerDetailActionsProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);

  const handleDelete = () => {
    if (!window.confirm("Are you sure you want to delete this prayer?")) return;
    setDeleting(true);
    fetch(`/api/prayers/${prayerId}`, { method: "DELETE" })
      .then((r) => {
        if (r.ok) {
          router.push("/dashboard/prayers");
          router.refresh();
        }
      })
      .finally(() => setDeleting(false));
  };

  const handleMarkPrayedFor = () => {
    setStatusLoading(true);
    fetch(`/api/prayers/${prayerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "prayed_for" }),
    })
      .then((r) => {
        if (r.ok) router.refresh();
      })
      .finally(() => setStatusLoading(false));
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canEdit && (
        <Link
          href={`/dashboard/prayers/${prayerId}/edit`}
          className="inline-flex items-center justify-center gap-2 rounded border-2 border-[var(--color-primary)] px-4 py-2 font-medium text-[var(--color-primary)] hover:bg-[var(--color-soft-blue-bg)] focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 focus:outline-none"
        >
          <FiEdit className="size-4" aria-hidden />
          Edit
        </Link>
      )}
      {canSetStatus && (
        <button
          type="button"
          onClick={handleMarkPrayedFor}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleMarkPrayedFor();
            }
          }}
          disabled={statusLoading}
          className="inline-flex items-center justify-center gap-2 rounded bg-[var(--color-primary)] px-4 py-2 font-medium text-white hover:bg-[var(--color-primary-hover)] focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 focus:outline-none disabled:opacity-50"
        >
          <FiCheck className="size-4" aria-hidden />
          Mark as prayed for
        </button>
      )}
      {canDelete && (
        <button
          type="button"
          onClick={handleDelete}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleDelete();
            }
          }}
          disabled={deleting}
          className="inline-flex items-center justify-center gap-2 rounded border-2 border-red-600 px-4 py-2 font-medium text-red-600 hover:bg-red-50 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:outline-none disabled:opacity-50"
        >
          <FiTrash2 className="size-4" aria-hidden />
          Delete
        </button>
      )}
    </div>
  );
}
