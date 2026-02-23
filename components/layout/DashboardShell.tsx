"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Sidebar, Navbar } from "@/components/layout";
import { useDebounce } from "@/hooks/useDebounce";
import type { NotificationItemData } from "@/components/ui/NotificationItem";
import type { RoleSlug } from "@/lib/permissions";

interface DashboardShellProps {
  user: { name?: string | null; email?: string | null };
  userId: string;
  roleSlug: RoleSlug;
  notifications: NotificationItemData[];
  unreadCount: number;
  pusherKey: string;
  pusherCluster: string;
  children: React.ReactNode;
}

export function DashboardShell({
  user,
  userId,
  roleSlug,
  notifications: initialNotifications,
  unreadCount: initialUnreadCount,
  pusherKey,
  pusherCluster,
  children,
}: DashboardShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItemData[]>(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);

  // Subscribe to Pusher for real-time notifications
  useEffect(() => {
    if (!pusherKey || !pusherCluster || !userId) return;
    let cancelled = false;
    let pusherInstance: InstanceType<typeof import("pusher-js").default> | null = null;
    import("pusher-js").then((mod) => {
      if (cancelled) return;
      pusherInstance = new mod.default(pusherKey, { cluster: pusherCluster });
      const channel = pusherInstance.subscribe(`notifications-${userId}`);
      channel.bind(
        "notification",
        (payload: {
          id: string;
          type: string;
          title: string;
          body: string;
          link?: string;
          ministryId?: string;
          createdAt: string;
        }) => {
          setNotifications((prev) => {
            if (prev.some((n) => n.id === payload.id)) return prev;
            const newNotif: NotificationItemData = {
              id: payload.id,
              type: payload.type,
              title: payload.title,
              body: payload.body,
              link: payload.link ?? null,
              read: false,
              createdAt: new Date(payload.createdAt),
            };
            return [newNotif, ...prev].slice(0, 10);
          });
          setUnreadCount((c) => c + 1);
        }
      );
    });
    return () => {
      cancelled = true;
      pusherInstance?.unsubscribe(`notifications-${userId}`);
    };
  }, [userId, pusherKey, pusherCluster]);

  const handleMarkNotificationRead = useCallback(async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
    await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
  }, []);

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {!sidebarCollapsed && (
        <div
          className="fixed inset-0 z-20 bg-black/50 md:hidden"
          role="button"
          tabIndex={0}
          aria-label="Close menu"
          onClick={() => setSidebarCollapsed(true)}
          onKeyDown={(e) => e.key === "Enter" && setSidebarCollapsed(true)}
        />
      )}
      <Sidebar roleSlug={roleSlug} collapsed={sidebarCollapsed} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Navbar
          user={user}
          roleSlug={roleSlug}
          notifications={notifications}
          unreadCount={unreadCount}
          onMarkNotificationRead={handleMarkNotificationRead}
          onOpenSearch={() => setSearchOpen(true)}
          onToggleSidebar={() => setSidebarCollapsed((v) => !v)}
        />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
      {searchOpen && <GlobalSearchModal onClose={() => setSearchOpen(false)} />}
    </div>
  );
}

/** Global search modal with debounced API results */
function GlobalSearchModal({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{
    users: { id: string; name: string; email: string }[];
    ministries: { id: string; name: string }[];
    arfs: { id: string; eventName: string }[];
    prfs: { id: string; purpose: string }[];
    lineups: { id: string; eventName: string }[];
    songs: { id: string; title: string; lineupId: string }[];
  } | null>(null);
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      queueMicrotask(() => setResults(null));
      return;
    }
    fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`)
      .then((r) => r.json())
      .then(setResults)
      .catch(() => setResults(null));
  }, [debouncedQuery]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-20"
      role="dialog"
      aria-modal="true"
      aria-label="Search"
    >
      <div className="w-full max-w-xl rounded-[var(--radius-lg)] bg-[var(--color-card-bg)] p-4 shadow-xl">
        <input
          type="search"
          placeholder="Search users, ministries, requests..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-[var(--radius)] border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-[var(--color-primary)] focus:outline-none"
          autoFocus
          onKeyDown={(e) => e.key === "Escape" && onClose()}
        />
        <div className="mt-2 max-h-96 overflow-auto">
          {results && (
            <ul className="space-y-2 text-sm">
              {results.users.map((u) => (
                <li key={u.id}>
                  <Link
                    href={`/dashboard/users?u=${u.id}`}
                    className="block rounded px-2 py-1 text-[var(--color-primary)] hover:bg-[var(--color-soft-blue-bg)]"
                    onClick={onClose}
                  >
                    User: {u.name} ({u.email})
                  </Link>
                </li>
              ))}
              {results.ministries.map((m) => (
                <li key={m.id}>
                  <span className="block rounded px-2 py-1 text-[var(--color-text-muted)]">
                    Ministry: {m.name}
                  </span>
                </li>
              ))}
              {results.arfs.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/dashboard/forms/arf/${a.id}`}
                    className="block rounded px-2 py-1 text-[var(--color-primary)] hover:bg-[var(--color-soft-blue-bg)]"
                    onClick={onClose}
                  >
                    ARF: {a.eventName}
                  </Link>
                </li>
              ))}
              {results.prfs.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/dashboard/forms/prf/${p.id}`}
                    className="block rounded px-2 py-1 text-[var(--color-primary)] hover:bg-[var(--color-soft-blue-bg)]"
                    onClick={onClose}
                  >
                    PRF: {p.purpose.slice(0, 50)}…
                  </Link>
                </li>
              ))}
              {results.lineups.map((l) => (
                <li key={l.id}>
                  <Link
                    href={`/dashboard/lineup/${l.id}`}
                    className="block rounded px-2 py-1 text-[var(--color-primary)] hover:bg-[var(--color-soft-blue-bg)]"
                    onClick={onClose}
                  >
                    Lineup: {l.eventName}
                  </Link>
                </li>
              ))}
              {results.songs.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/dashboard/lineup/${s.lineupId}`}
                    className="block rounded px-2 py-1 text-[var(--color-primary)] hover:bg-[var(--color-soft-blue-bg)]"
                    onClick={onClose}
                  >
                    Song: {s.title}
                  </Link>
                </li>
              ))}
              {results.users.length === 0 &&
                results.ministries.length === 0 &&
                results.arfs.length === 0 &&
                results.prfs.length === 0 &&
                results.lineups.length === 0 &&
                results.songs.length === 0 && (
                  <li className="px-2 py-2 text-[var(--color-text-muted)]">No results</li>
                )}
            </ul>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-2 text-sm text-[var(--color-primary)] hover:underline"
        >
          Close
        </button>
      </div>
    </div>
  );
}
