"use client";

import { useState } from "react";
import Link from "next/link";
import { FiMenu, FiBell, FiSearch } from "react-icons/fi";
import { Avatar, Button, Dropdown } from "@/components/ui";
import type { NotificationItemData } from "@/components/ui/NotificationItem";
import { NotificationItem } from "@/components/ui/NotificationItem";
import type { RoleSlug } from "@/lib/permissions";

export interface NavbarProps {
  user: { name?: string | null; email?: string | null };
  roleSlug: RoleSlug;
  notifications: NotificationItemData[];
  unreadCount: number;
  onMarkNotificationRead: (id: string) => void;
  onOpenSearch: () => void;
  onToggleSidebar?: () => void;
}

export function Navbar({
  user,
  notifications,
  unreadCount,
  onMarkNotificationRead,
  onOpenSearch,
  onToggleSidebar,
}: NavbarProps) {
  const [notifOpen, setNotifOpen] = useState(false);

  const userMenuItems = [
    {
      id: "profile",
      label: "My profile",
      onClick: () => window.location.assign("/dashboard/profile"),
    },
    { id: "dashboard", label: "Dashboard", onClick: () => window.location.assign("/dashboard") },
    { id: "logout", label: "Sign out", onClick: () => window.location.assign("/api/auth/signout") },
  ];

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-4 border-b border-gray-200 bg-[var(--color-card-bg)] px-4">
      <div className="flex items-center gap-2">
        {onToggleSidebar && (
          <Button
            variant="icon"
            aria-label="Toggle sidebar"
            onClick={onToggleSidebar}
            icon={<FiMenu className="size-5" />}
          />
        )}
        <Link
          href="/dashboard"
          className="text-lg font-semibold text-[var(--color-text-dark)] hover:opacity-90"
        >
          Church Ministry
        </Link>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          aria-label="Open search"
          onClick={onOpenSearch}
          icon={<FiSearch className="size-5" />}
        />
        <div className="relative inline-block">
          <Button
            variant="icon"
            aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : "Notifications"}
            onClick={() => setNotifOpen((v) => !v)}
            icon={<FiBell className="size-5" />}
          />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
          {notifOpen && (
            <>
              <div className="fixed inset-0 z-10" aria-hidden onClick={() => setNotifOpen(false)} />
              <div className="absolute top-full right-0 z-20 mt-1 max-h-[400px] w-80 overflow-auto rounded-[var(--radius-lg)] border border-gray-200 bg-[var(--color-card-bg)] p-2 shadow-lg">
                <p className="mb-2 px-2 text-sm font-medium text-[var(--color-text-muted)]">
                  Notifications
                </p>
                {notifications.length === 0 ? (
                  <p className="px-2 py-4 text-sm text-[var(--color-text-muted)]">
                    No notifications
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {notifications.map((n) => (
                      <li key={n.id}>
                        <NotificationItem notification={n} onMarkRead={onMarkNotificationRead} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
        <Dropdown
          trigger={
            <span className="flex items-center gap-2">
              <Avatar name={user.name ?? "User"} size="sm" />
              <span className="max-w-[120px] truncate text-sm font-medium text-[var(--color-text-dark)]">
                {user.name ?? "User"}
              </span>
            </span>
          }
          items={userMenuItems}
          align="right"
        />
      </div>
    </header>
  );
}
