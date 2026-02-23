"use client";

import Link from "next/link";
import { Avatar } from "./Avatar";

export interface NotificationItemData {
  id: string;
  type: string;
  title: string;
  body: string;
  link?: string | null;
  read: boolean;
  createdAt: Date;
  /** Optional for display */
  actorName?: string;
}

export interface NotificationItemProps {
  notification: NotificationItemData;
  onMarkRead?: (id: string) => void;
}

export function NotificationItem({ notification, onMarkRead }: NotificationItemProps) {
  const content = (
    <div
      className={`flex gap-3 rounded-[var(--radius)] p-3 ${
        notification.read ? "bg-transparent" : "bg-[var(--color-soft-blue-bg)]"
      }`}
    >
      <Avatar name={notification.actorName ?? "System"} size="sm" className="shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-[var(--color-text-dark)]">{notification.title}</p>
        <p className="line-clamp-2 text-sm text-[var(--color-text-muted)]">{notification.body}</p>
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
          {new Date(notification.createdAt).toLocaleString()}
        </p>
      </div>
    </div>
  );

  const handleClick = () => {
    if (onMarkRead && !notification.read) {
      onMarkRead(notification.id);
    }
  };

  const wrapperClassName = "block w-full text-left hover:opacity-90 transition";

  if (notification.link) {
    return (
      <Link href={notification.link} className={wrapperClassName} onClick={handleClick}>
        {content}
      </Link>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      className={wrapperClassName}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      {content}
    </div>
  );
}
