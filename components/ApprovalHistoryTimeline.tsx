import { FiCheck, FiX } from "react-icons/fi";
import { formatManilaDateTime } from "@/lib/dates";

export interface ApprovalHistoryItem {
  action: string;
  performedByName: string;
  comment: string | null;
  createdAt: Date;
}

export function ApprovalHistoryTimeline({ items }: { items: ApprovalHistoryItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-[var(--color-text-muted)]">No approval history yet.</p>;
  }
  return (
    <ul className="space-y-4">
      {items.map((item) => (
        <li key={item.createdAt.toISOString()} className="flex gap-3">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-soft-blue-bg)]"
            aria-hidden
          >
            {item.action === "approved" ? (
              <FiCheck className="size-4 text-green-600" />
            ) : (
              <FiX className="size-4 text-red-600" />
            )}
          </span>
          <div>
            <p className="font-medium text-[var(--color-text-dark)]">
              {item.action === "approved" ? "Approved" : "Rejected"} by {item.performedByName}
            </p>
            <p className="text-sm text-[var(--color-text-muted)]">
              {formatManilaDateTime(item.createdAt)}
            </p>
            {item.comment && (
              <p className="mt-1 text-sm text-[var(--color-text-dark)]">{item.comment}</p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
