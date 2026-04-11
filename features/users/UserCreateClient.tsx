"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { UserForm, type UserFormSubmitBody } from "./UserForm";

interface Ministry {
  id: string;
  name: string;
}

export interface UserCreateClientProps {
  allMinistries: Ministry[];
  editorIsAdmin: boolean;
  editorHeadOfMinistryIds: string[];
}

export function UserCreateClient({
  allMinistries,
  editorIsAdmin,
  editorHeadOfMinistryIds,
}: UserCreateClientProps) {
  const router = useRouter();

  const onSubmit = useCallback(
    async (body: UserFormSubmitBody) => {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          message?: string;
          error?: string;
        };
        throw new Error(data.message ?? data.error ?? "Create failed");
      }
      router.push("/dashboard/users");
      router.refresh();
    },
    [router]
  );

  return (
    <UserForm
      allMinistries={allMinistries}
      editorIsAdmin={editorIsAdmin}
      editorHeadOfMinistryIds={editorHeadOfMinistryIds}
      onSubmit={onSubmit}
      submitLabel="Create user"
    />
  );
}
