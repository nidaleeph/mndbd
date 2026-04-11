"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

interface Ministry {
  id: string;
  name: string;
  role: "head" | "member";
}

interface UserRow {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
  status: "pending" | "active" | "inactive";
  createdAt: string;
  ministries: Ministry[];
}

interface AllMinistry {
  id: string;
  name: string;
}

type Tab = "active" | "pending";

export interface UsersTableClientProps {
  viewerIsAdmin: boolean;
  allMinistries: AllMinistry[];
}

export function UsersTableClient({ viewerIsAdmin, allMinistries }: UsersTableClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as Tab) || "active";

  const [tab, setTab] = useState<Tab>(
    initialTab === "pending" && viewerIsAdmin ? "pending" : "active"
  );
  const [activeUsers, setActiveUsers] = useState<UserRow[] | null>(null);
  const [pendingUsers, setPendingUsers] = useState<UserRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    try {
      const res = await fetch(`/api/users?tab=${tab}`, { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`Failed to load users (${res.status})`);
      }
      const data = (await res.json()) as { users: UserRow[] };
      if (tab === "active") setActiveUsers(data.users);
      else setPendingUsers(data.users);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    }
  }, [tab]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Background-load pending count for the badge (admin only)
  useEffect(() => {
    if (!viewerIsAdmin || tab === "pending") return;
    fetch("/api/users?tab=pending", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("badge load failed"))))
      .then((data: { users: UserRow[] }) => setPendingUsers(data.users))
      .catch(() => {
        /* silent */
      });
  }, [viewerIsAdmin, tab]);

  const pendingCount = pendingUsers?.length ?? 0;

  const switchTab = useCallback((next: Tab) => {
    setTab(next);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    window.history.replaceState({}, "", url.toString());
  }, []);

  return (
    <div>
      <div className="mb-4 flex gap-2 border-b border-[var(--color-border)]">
        <button
          type="button"
          onClick={() => switchTab("active")}
          className={`border-b-2 px-4 py-2 text-sm font-medium ${
            tab === "active"
              ? "border-[var(--color-primary)] text-[var(--color-primary)]"
              : "border-transparent text-[var(--color-text-muted)]"
          }`}
        >
          Active
          {activeUsers ? ` (${activeUsers.length})` : ""}
        </button>
        {viewerIsAdmin ? (
          <button
            type="button"
            onClick={() => switchTab("pending")}
            className={`border-b-2 px-4 py-2 text-sm font-medium ${
              tab === "pending"
                ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                : "border-transparent text-[var(--color-text-muted)]"
            }`}
          >
            Pending
            {pendingCount > 0 ? (
              <span className="ml-1 inline-flex items-center rounded-full bg-red-600 px-2 text-xs text-white">
                {pendingCount}
              </span>
            ) : null}
          </button>
        ) : null}
      </div>

      {error ? (
        <div className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {tab === "active" ? (
        <ActiveUsersTable users={activeUsers} />
      ) : (
        <PendingUsersTable
          users={pendingUsers}
          allMinistries={allMinistries}
          onChanged={() => {
            loadUsers();
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function ActiveUsersTable({ users }: { users: UserRow[] | null }) {
  if (users === null) return <div className="text-[var(--color-text-muted)]">Loading…</div>;
  if (users.length === 0)
    return <div className="text-[var(--color-text-muted)]">No users found.</div>;

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-text-muted)] uppercase">
          <th className="p-2">Name</th>
          <th className="p-2">Email</th>
          <th className="p-2">Ministries</th>
          <th className="p-2">Status</th>
          <th className="p-2" />
        </tr>
      </thead>
      <tbody>
        {users.map((u) => (
          <tr key={u.id} className="border-b border-[var(--color-border)]">
            <td className="p-2">
              <Link
                href={`/dashboard/users/${u.id}`}
                className="text-[var(--color-primary)] hover:underline"
              >
                {u.name}
              </Link>
              {u.isAdmin ? (
                <span className="ml-2 inline-flex items-center rounded bg-yellow-100 px-1 text-xs text-yellow-800">
                  admin
                </span>
              ) : null}
            </td>
            <td className="p-2 text-[var(--color-text-muted)]">{u.email}</td>
            <td className="p-2">
              <div className="flex flex-wrap gap-1">
                {u.ministries.map((m) => (
                  <span
                    key={m.id}
                    className={`rounded px-2 py-0.5 text-xs ${
                      m.role === "head"
                        ? "bg-[var(--color-primary)] text-white"
                        : "border border-[var(--color-border)] text-[var(--color-text-dark)]"
                    }`}
                  >
                    {m.name}
                    {m.role === "head" ? " · head" : ""}
                  </span>
                ))}
                {u.ministries.length === 0 ? (
                  <span className="text-xs text-[var(--color-text-muted)]">—</span>
                ) : null}
              </div>
            </td>
            <td className="p-2">
              {u.status === "inactive" ? (
                <span className="rounded bg-gray-200 px-2 py-0.5 text-xs text-gray-700">
                  inactive
                </span>
              ) : null}
            </td>
            <td className="p-2 text-right">
              <Link
                href={`/dashboard/users/${u.id}/edit`}
                className="text-xs text-[var(--color-primary)] hover:underline"
              >
                Edit
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PendingUsersTable({
  users,
  allMinistries,
  onChanged,
}: {
  users: UserRow[] | null;
  allMinistries: AllMinistry[];
  onChanged: () => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (users === null) return <div className="text-[var(--color-text-muted)]">Loading…</div>;
  if (users.length === 0)
    return <div className="text-[var(--color-text-muted)]">No pending signups.</div>;

  const approve = async (userId: string, ministryIds: string[]) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/users/${userId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ministryIds }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(d.message ?? "Approve failed");
      }
      setExpandedId(null);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approve failed");
    } finally {
      setBusy(false);
    }
  };

  const reject = async (userId: string) => {
    if (
      !window.confirm(
        "Reject this signup? The user will be deleted. If they want to try again, they'll need to sign up from scratch."
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/users/${userId}/reject`, { method: "DELETE" });
      if (!res.ok) throw new Error("Reject failed");
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reject failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {error ? (
        <div className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-text-muted)] uppercase">
            <th className="p-2">Name</th>
            <th className="p-2">Email</th>
            <th className="p-2">Requested ministries</th>
            <th className="p-2">Submitted</th>
            <th className="p-2" />
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <ApproveRow
              key={u.id}
              user={u}
              allMinistries={allMinistries}
              expanded={expandedId === u.id}
              busy={busy}
              onExpand={() => setExpandedId(expandedId === u.id ? null : u.id)}
              onApprove={(mIds) => approve(u.id, mIds)}
              onReject={() => reject(u.id)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ApproveRow({
  user,
  allMinistries,
  expanded,
  busy,
  onExpand,
  onApprove,
  onReject,
}: {
  user: UserRow;
  allMinistries: AllMinistry[];
  expanded: boolean;
  busy: boolean;
  onExpand: () => void;
  onApprove: (ministryIds: string[]) => void;
  onReject: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(user.ministries.map((m) => m.id))
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <>
      <tr className="border-b border-[var(--color-border)]">
        <td className="p-2 font-medium">{user.name}</td>
        <td className="p-2 text-[var(--color-text-muted)]">{user.email}</td>
        <td className="p-2">
          <div className="flex flex-wrap gap-1">
            {user.ministries.map((m) => (
              <span
                key={m.id}
                className="rounded border border-[var(--color-border)] px-2 py-0.5 text-xs"
              >
                {m.name}
              </span>
            ))}
          </div>
        </td>
        <td className="p-2 text-xs text-[var(--color-text-muted)]">
          {new Date(user.createdAt).toLocaleString("en-US", {
            month: "short",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </td>
        <td className="p-2 text-right">
          <button
            type="button"
            onClick={onExpand}
            className="mr-2 rounded bg-green-600 px-3 py-1 text-xs text-white hover:bg-green-700"
          >
            Approve
          </button>
          <button
            type="button"
            onClick={onReject}
            disabled={busy}
            className="rounded border border-red-600 px-3 py-1 text-xs text-red-600 hover:bg-red-50"
          >
            Reject
          </button>
        </td>
      </tr>
      {expanded ? (
        <tr>
          <td
            colSpan={5}
            className="border-b border-[var(--color-border)] bg-[var(--color-soft-blue-bg)] p-4"
          >
            <div className="mb-2 text-sm font-semibold">Approving {user.name}</div>
            <div className="mb-2 text-xs text-[var(--color-text-muted)]">
              Assign to which ministries? (pre-checked from request)
            </div>
            <div className="mb-3 grid grid-cols-2 gap-1 md:grid-cols-3">
              {allMinistries.map((m) => (
                <label key={m.id} className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={selected.has(m.id)}
                    onChange={() => toggle(m.id)}
                  />
                  <span>{m.name}</span>
                </label>
              ))}
            </div>
            <div className="mb-3 text-xs text-[var(--color-text-muted)]">
              Note: all assignments default to &quot;member&quot;. You can promote to head from the
              user&apos;s edit page after approval.
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onExpand}
                disabled={busy}
                className="rounded border border-[var(--color-border)] px-3 py-1 text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => onApprove(Array.from(selected))}
                disabled={busy || selected.size === 0}
                className="rounded bg-green-600 px-3 py-1 text-xs text-white disabled:opacity-50"
              >
                Confirm approve
              </button>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}
