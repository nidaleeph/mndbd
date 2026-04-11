"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { UserForm, type UserFormInitial, type UserFormSubmitBody } from "./UserForm";

interface Ministry {
  id: string;
  name: string;
}

export interface UserEditClientProps {
  initial: UserFormInitial;
  allMinistries: Ministry[];
  editorIsAdmin: boolean;
  editorHeadOfMinistryIds: string[];
}

export function UserEditClient({
  initial,
  allMinistries,
  editorIsAdmin,
  editorHeadOfMinistryIds,
}: UserEditClientProps) {
  const router = useRouter();

  const onSubmit = useCallback(
    async (body: UserFormSubmitBody) => {
      const res = await fetch(`/api/users/${initial.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          message?: string;
          error?: string;
        };
        throw new Error(data.message ?? data.error ?? "Save failed");
      }
      router.push("/dashboard/users");
      router.refresh();
    },
    [initial.id, router]
  );

  return (
    <UserForm
      initial={initial}
      allMinistries={allMinistries}
      editorIsAdmin={editorIsAdmin}
      editorHeadOfMinistryIds={editorHeadOfMinistryIds}
      onSubmit={onSubmit}
      submitLabel="Save changes"
    />
  );
}
