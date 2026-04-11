"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Card, Section } from "@/components/ui";
import { profileUpdateSchema, type ProfileUpdateFormData } from "@/schemas/profile";

interface ProfileData {
  id: string;
  name: string;
  email: string;
  address: string | null;
  age: number | null;
  birthday: string | null;
  isAdmin: boolean;
  ministries: { id: string; name: string; role: "head" | "member" }[];
}

export function ProfileForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<ProfileUpdateFormData & { password?: string }>({
    name: "",
    email: "",
    address: "",
    age: null,
    birthday: null,
    password: "",
  });
  const [rolesAndMinistries, setRolesAndMinistries] = useState<{
    isAdmin: boolean;
    ministries: { id: string; name: string; role: "head" | "member" }[];
  } | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof ProfileUpdateFormData, string>>>({});

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed to load"))))
      .then((data: ProfileData) => {
        setFormData({
          name: data.name,
          email: data.email,
          address: data.address ?? "",
          age: data.age,
          birthday: data.birthday ?? null,
          password: "",
        });
        setRolesAndMinistries({
          isAdmin: data.isAdmin,
          ministries: data.ministries,
        });
      })
      .catch(() => setError("Failed to load profile"));
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = e.target;
      if (name === "age") {
        setFormData((prev) => ({
          ...prev,
          age: value === "" ? null : Number(value),
        }));
      } else if (name === "birthday") {
        setFormData((prev) => ({
          ...prev,
          birthday: value === "" ? null : value,
        }));
      } else {
        setFormData((prev) => ({ ...prev, [name]: value }));
      }
      if (errors[name as keyof ProfileUpdateFormData]) {
        setErrors((prev) => ({ ...prev, [name]: undefined }));
      }
    },
    [errors]
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setError(null);
      setLoading(true);
      try {
        const payload = {
          name: formData.name,
          email: formData.email,
          address: formData.address || undefined,
          age: formData.age ?? undefined,
          birthday: formData.birthday ?? undefined,
          ...(formData.password &&
            formData.password.trim().length > 0 && { password: formData.password }),
        };
        const parsed = profileUpdateSchema.safeParse(payload);
        if (!parsed.success) {
          const fieldErrors: Partial<Record<keyof ProfileUpdateFormData, string>> = {};
          parsed.error.errors.forEach((err) => {
            const path = err.path[0] as keyof ProfileUpdateFormData;
            if (path) fieldErrors[path] = err.message;
          });
          setErrors(fieldErrors);
          return;
        }
        setErrors({});
        const res = await fetch("/api/profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.message ?? "Update failed");
          return;
        }
        router.refresh();
        setFormData((prev) => ({ ...prev, password: "" }));
      } catch {
        setError("Something went wrong");
      } finally {
        setLoading(false);
      }
    },
    [formData, router]
  );

  if (rolesAndMinistries === null && !error) {
    return <div className="text-[var(--color-text-muted)]">Loading profile…</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <Section title="Edit your details">
        <Card>
          <div className="flex flex-col gap-4">
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
            <Input
              label="Address"
              name="address"
              type="text"
              value={formData.address ?? ""}
              onChange={handleChange}
              error={errors.address}
            />
            <Input
              label="Age"
              name="age"
              type="number"
              min={0}
              max={150}
              value={formData.age ?? ""}
              onChange={handleChange}
              error={errors.age}
            />
            <Input
              label="Birthday"
              name="birthday"
              type="date"
              value={formData.birthday ?? ""}
              onChange={handleChange}
              error={errors.birthday}
            />
            <Input
              label="New password (leave blank to keep current)"
              name="password"
              type="password"
              autoComplete="new-password"
              value={formData.password ?? ""}
              onChange={handleChange}
              error={errors.password}
            />
          </div>
        </Card>
      </Section>

      {rolesAndMinistries && (
        <Section title="Roles & ministries">
          <Card>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-[var(--color-text-muted)]">Account</dt>
                <dd className="font-medium">
                  {rolesAndMinistries.isAdmin ? "Administrator" : "Member"}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-[var(--color-text-muted)]">Ministries</dt>
                <dd>
                  {rolesAndMinistries.ministries.length === 0 ? (
                    <span className="text-[var(--color-text-muted)]">None</span>
                  ) : (
                    <ul className="list-disc pl-5">
                      {rolesAndMinistries.ministries.map((m) => (
                        <li key={m.id}>
                          {m.name}
                          {m.role === "head" && (
                            <span className="ml-2 text-xs text-[var(--color-text-muted)]">
                              (head)
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </dd>
              </div>
            </dl>
          </Card>
        </Section>
      )}

      <div className="flex gap-2">
        <Button type="submit" loading={loading}>
          Save changes
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
