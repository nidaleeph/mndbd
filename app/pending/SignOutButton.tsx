"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="rounded border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text-dark)] hover:bg-[var(--color-soft-blue-bg)]"
    >
      Sign out
    </button>
  );
}
