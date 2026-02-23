"use client";

import Link from "next/link";

interface UserRow {
  id: string;
  name: string;
  email: string;
  ministry: { name: string } | null;
  userMinistries?: { ministry: { name: string } }[];
  role: { name: string };
  status: string;
}

interface UsersTableClientProps {
  users: UserRow[];
  emptyMessage?: string;
}

/**
 * Client component for users table - renders Link in name column.
 * Avoids passing cell functions from server to client.
 */
export function UsersTableClient({
  users,
  emptyMessage = "No users found.",
}: UsersTableClientProps) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)]">
      <table className="w-full min-w-[400px] text-left text-sm">
        <thead className="border-b border-[var(--color-border)] bg-[var(--color-soft-blue-bg)]">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium text-[var(--color-text-dark)]">
              Name
            </th>
            <th scope="col" className="px-4 py-3 font-medium text-[var(--color-text-dark)]">
              Email
            </th>
            <th scope="col" className="px-4 py-3 font-medium text-[var(--color-text-dark)]">
              Ministries
            </th>
            <th scope="col" className="px-4 py-3 font-medium text-[var(--color-text-dark)]">
              Role
            </th>
            <th scope="col" className="px-4 py-3 font-medium text-[var(--color-text-dark)]">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {users.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-[var(--color-text-muted)]">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            users.map((row) => (
              <tr key={row.id} className="hover:bg-[var(--color-soft-blue-bg)]/50">
                <td className="px-4 py-3 text-[var(--color-text-dark)]">
                  <Link
                    href={`/dashboard/users/${row.id}`}
                    className="text-[var(--color-primary)] hover:underline"
                  >
                    {row.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-[var(--color-text-dark)]">{row.email}</td>
                <td className="px-4 py-3 text-[var(--color-text-dark)]">
                  {[
                    ...(row.ministry ? [row.ministry.name] : []),
                    ...(row.userMinistries?.map((um) => um.ministry.name).filter(Boolean) ?? []),
                  ]
                    .filter((v, i, a) => a.indexOf(v) === i)
                    .join(", ") || "—"}
                </td>
                <td className="px-4 py-3 text-[var(--color-text-dark)]">{row.role.name}</td>
                <td className="px-4 py-3 text-[var(--color-text-dark)]">{row.status}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
