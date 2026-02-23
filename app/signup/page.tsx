"use client";

import { useState, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Input, Card, Select } from "@/components/ui";
import { signupSchema, type SignupFormData } from "@/schemas/user";
import type { SelectOption } from "@/components/ui/Select";

export default function SignupPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "authenticated" && session?.userId) {
      router.replace("/dashboard");
    }
  }, [status, session?.userId, router]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<SignupFormData>({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    roleId: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof SignupFormData, string>>>({});
  const [roles, setRoles] = useState<SelectOption[]>([]);
  const [ministries, setMinistries] = useState<SelectOption[]>([]);

  useEffect(() => {
    fetch("/api/options/roles?for=signup")
      .then((r) => r.json())
      .then((data: { id: string; name: string }[]) =>
        setRoles(data.map((r) => ({ value: r.id, label: r.name })))
      )
      .catch(() => {});
    fetch("/api/options/ministries")
      .then((r) => r.json())
      .then((data: { id: string; name: string }[]) =>
        setMinistries([
          { value: "", label: "No ministry" },
          ...data.map((m) => ({ value: m.id, label: m.name })),
        ])
      )
      .catch(() => {});
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof SignupFormData]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const parsed = signupSchema.safeParse(formData);
    if (!parsed.success) {
      const fieldErrors: Partial<Record<keyof SignupFormData, string>> = {};
      parsed.error.errors.forEach((err) => {
        const path = err.path[0] as keyof SignupFormData;
        if (path) fieldErrors[path] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: parsed.data.name,
          email: parsed.data.email,
          password: parsed.data.password,
          roleId: parsed.data.roleId,
          ministryId: parsed.data.ministryId || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message ?? "Registration failed.");
        return;
      }
      // signIn with redirect: true so NextAuth handles redirect and cookie
      const result = await signIn("credentials", {
        email: parsed.data.email,
        password: parsed.data.password,
        callbackUrl: "/dashboard",
        redirect: true,
      });
      if (result?.error) {
        setError("Account created. Please sign in.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (status === "loading" || (status === "authenticated" && session?.userId)) {
    return (
      <main className="p-page flex min-h-screen items-center justify-center bg-[var(--color-soft-blue-bg)]">
        <p className="text-[var(--color-text-muted)]">Redirecting...</p>
      </main>
    );
  }

  return (
    <main className="p-page flex min-h-screen items-center justify-center bg-[var(--color-soft-blue-bg)]">
      <Card className="w-full max-w-md">
        <h1 className="mb-2 text-xl font-bold text-[var(--color-text-dark)]">Sign up</h1>
        <p className="mb-6 text-sm text-[var(--color-text-muted)]">
          Create your Church Ministry account
        </p>
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
            autoComplete="name"
            value={formData.name}
            onChange={handleChange}
            error={errors.name}
          />
          <Input
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            value={formData.email}
            onChange={handleChange}
            error={errors.email}
          />
          <Input
            label="Password"
            name="password"
            type="password"
            autoComplete="new-password"
            value={formData.password}
            onChange={handleChange}
            error={errors.password}
          />
          <Input
            label="Confirm password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={formData.confirmPassword}
            onChange={handleChange}
            error={errors.confirmPassword}
          />
          {roles.length > 0 && (
            <Select
              label="Role"
              name="roleId"
              options={roles}
              value={formData.roleId}
              onChange={handleChange}
              error={errors.roleId}
            />
          )}
          {ministries.length > 1 && (
            <Select
              label="Ministry"
              name="ministryId"
              options={ministries}
              value={formData.ministryId ?? ""}
              onChange={handleChange}
            />
          )}
          <Button type="submit" variant="primary" loading={loading} className="w-full">
            Create account
          </Button>
        </form>
        <p className="mt-4 text-sm text-[var(--color-text-muted)]">
          Already have an account?{" "}
          <Link href="/login" className="text-[var(--color-primary)] hover:underline">
            Sign in
          </Link>
        </p>
      </Card>
    </main>
  );
}
