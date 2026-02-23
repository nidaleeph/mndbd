"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, MultiSelect, Select } from "@/components/ui";
import { userCreateSchema, userUpdateSchema } from "@/schemas/user";
import type { UserCreateFormData, UserUpdateFormData } from "@/schemas/user";
import type { SelectOption } from "@/components/ui/Select";

interface UserFormProps {
  /** Create mode when undefined; edit mode when user id provided */
  userId?: string;
}

/**
 * Shared form for creating and editing users.
 * Create: name, email, password, role, ministries.
 * Edit: name, email, ministries, role, status (no password unless explicitly added later).
 */
export function UserForm({ userId }: UserFormProps) {
  const router = useRouter();
  const isEdit = Boolean(userId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roles, setRoles] = useState<SelectOption[]>([]);
  const [ministries, setMinistries] = useState<SelectOption[]>([]);
  const [formData, setFormData] = useState<UserCreateFormData & Partial<UserUpdateFormData>>({
    name: "",
    email: "",
    password: "",
    roleId: "",
    ministryIds: [],
    status: "active",
  });
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});

  const ministriesUrl = isEdit
    ? "/api/options/ministries"
    : "/api/options/ministries?context=user-create";

  useEffect(() => {
    fetch("/api/options/roles")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: { id: string; name: string }[]) =>
        setRoles(data.map((r) => ({ value: r.id, label: r.name })))
      )
      .catch(() => {});
    fetch(ministriesUrl)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: { id: string; name: string }[]) =>
        setMinistries(data.map((m) => ({ value: m.id, label: m.name })))
      )
      .catch(() => {});
  }, [ministriesUrl]);

  useEffect(() => {
    if (userId) {
      fetch(`/api/users/${userId}`)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed to load"))))
        .then(
          (data: {
            name: string;
            email: string;
            ministryIds: string[];
            roleId: string;
            status: string;
          }) => {
            setFormData((prev) => ({
              ...prev,
              name: data.name,
              email: data.email,
              ministryIds: data.ministryIds ?? [],
              roleId: data.roleId,
              status: data.status === "inactive" ? "inactive" : "active",
            }));
          }
        )
        .catch(() => setError("Failed to load user"));
    }
  }, [userId]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      setFormData((prev) => ({ ...prev, [name]: value === "" ? "" : value }));
      if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
    },
    [errors]
  );

  const handleMinistryIdsChange = useCallback(
    (ids: string[]) => {
      setFormData((prev) => ({ ...prev, ministryIds: ids }));
      if (errors.ministryIds) setErrors((prev) => ({ ...prev, ministryIds: undefined }));
    },
    [errors.ministryIds]
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setError(null);
      setLoading(true);
      try {
        if (isEdit) {
          const parsed = userUpdateSchema.safeParse({
            name: formData.name,
            email: formData.email,
            ministryIds: formData.ministryIds ?? [],
            roleId: formData.roleId || undefined,
            status: formData.status,
          });
          if (!parsed.success) {
            const fieldErrors: Partial<Record<string, string>> = {};
            parsed.error.errors.forEach((err) => {
              const path = err.path[0] as string;
              if (path) fieldErrors[path] = err.message;
            });
            setErrors(fieldErrors);
            return;
          }
          const res = await fetch(`/api/users/${userId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(parsed.data),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            setError(data.message ?? "Update failed");
            return;
          }
          router.push(`/dashboard/users/${userId}`);
          router.refresh();
        } else {
          const parsed = userCreateSchema.safeParse({
            name: formData.name,
            email: formData.email,
            password: formData.password,
            roleId: formData.roleId,
            ministryIds: formData.ministryIds ?? [],
          });
          if (!parsed.success) {
            const fieldErrors: Partial<Record<string, string>> = {};
            parsed.error.errors.forEach((err) => {
              const path = err.path[0] as string;
              if (path) fieldErrors[path] = err.message;
            });
            setErrors(fieldErrors);
            return;
          }
          const res = await fetch("/api/users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(parsed.data),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            setError(data.message ?? data.error ?? "Create failed");
            return;
          }
          router.push(`/dashboard/users/${data.id}`);
          router.refresh();
        }
      } catch {
        setError("Something went wrong");
      } finally {
        setLoading(false);
      }
    },
    [isEdit, userId, formData, router]
  );

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <Input
        label="Name"
        name="name"
        type="text"
        value={formData.name}
        onChange={handleChange}
        error={errors.name}
      />
      <Input
        label="Email"
        name="email"
        type="email"
        value={formData.email}
        onChange={handleChange}
        error={errors.email}
      />
      {!isEdit && (
        <Input
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          value={formData.password}
          onChange={handleChange}
          error={errors.password}
        />
      )}
      <Select
        label="Role"
        name="roleId"
        options={roles}
        value={formData.roleId}
        onChange={handleChange}
        error={errors.roleId}
      />
      <MultiSelect
        label="Ministries"
        options={ministries}
        value={formData.ministryIds ?? []}
        onChange={handleMinistryIdsChange}
        error={errors.ministryIds}
      />
      {isEdit && (
        <Select
          label="Status"
          name="status"
          options={[
            { value: "active", label: "Active" },
            { value: "inactive", label: "Inactive" },
          ]}
          value={formData.status ?? "active"}
          onChange={handleChange}
        />
      )}
      <div className="flex gap-2">
        <Button type="submit" loading={loading}>
          {isEdit ? "Save changes" : "Create user"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
