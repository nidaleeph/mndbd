"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Input, Card } from "@/components/ui";

interface Ministry {
  id: string;
  name: string;
  description?: string | null;
}

interface FormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  ministryIds: string[];
}

export default function SignupPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [ministries, setMinistries] = useState<Ministry[]>([]);
  const [formData, setFormData] = useState<FormData>({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    ministryIds: [],
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Redirect authenticated users
  useEffect(() => {
    if (status === "authenticated" && session?.userId) {
      if (session.status === "pending") {
        router.replace("/pending");
      } else {
        router.replace("/dashboard");
      }
    }
  }, [status, session?.userId, session?.status, router]);

  // Load ministries
  useEffect(() => {
    fetch("/api/options/ministries", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed to load ministries"))))
      .then((data: { ministries?: Ministry[] } | Ministry[]) => {
        const list = Array.isArray(data) ? data : (data.ministries ?? []);
        setMinistries(list);
      })
      .catch(() => setMinistries([]));
  }, []);

  const toggleMinistry = useCallback((id: string) => {
    setFormData((prev) => ({
      ...prev,
      ministryIds: prev.ministryIds.includes(id)
        ? prev.ministryIds.filter((m) => m !== id)
        : [...prev.ministryIds, id],
    }));
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitError(null);
      const nextErrors: Partial<Record<keyof FormData, string>> = {};
      if (!formData.name.trim()) nextErrors.name = "Name is required";
      if (!formData.email) nextErrors.email = "Email is required";
      if (formData.password.length < 8) nextErrors.password = "Min 8 characters";
      if (formData.password !== formData.confirmPassword) {
        nextErrors.confirmPassword = "Passwords do not match";
      }
      if (formData.ministryIds.length === 0) {
        nextErrors.ministryIds = "Pick at least one ministry";
      }
      setErrors(nextErrors);
      if (Object.keys(nextErrors).length > 0) return;

      setLoading(true);
      try {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { message?: string };
          throw new Error(data.message ?? "Signup failed");
        }
        setSuccess(true);
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : "Signup failed");
      } finally {
        setLoading(false);
      }
    },
    [formData]
  );

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Card className="w-full max-w-md p-8 text-center">
          <h1 className="mb-2 text-xl font-semibold">Thanks for signing up</h1>
          <p className="mb-6 text-sm text-[var(--color-text-muted)]">
            An admin will review your request. You&apos;ll be able to sign in once your account is
            approved.
          </p>
          <Link
            href="/login"
            className="inline-block rounded-[var(--radius)] bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white"
          >
            Go to login
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md p-8">
        <h1 className="mb-6 text-xl font-semibold">Sign up</h1>
        {submitError ? (
          <div className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
            {submitError}
          </div>
        ) : null}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            error={errors.name}
          />
          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            error={errors.email}
          />
          <Input
            label="Password"
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            error={errors.password}
          />
          <Input
            label="Confirm password"
            type="password"
            value={formData.confirmPassword}
            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
            error={errors.confirmPassword}
          />

          <div>
            <label className="mb-2 block text-sm font-medium">
              Ministries <span className="text-[var(--color-text-muted)]">(pick one or more)</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {ministries.map((m) => {
                const selected = formData.ministryIds.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleMinistry(m.id)}
                    className={`rounded border p-2 text-left text-xs transition ${
                      selected
                        ? "border-[var(--color-primary)] bg-[var(--color-soft-blue-bg)]"
                        : "border-[var(--color-border)]"
                    }`}
                  >
                    <div className="font-medium">{m.name}</div>
                    {m.description ? (
                      <div className="text-[var(--color-text-muted)]">{m.description}</div>
                    ) : null}
                  </button>
                );
              })}
            </div>
            {errors.ministryIds ? (
              <div className="mt-1 text-xs text-red-600">{errors.ministryIds}</div>
            ) : null}
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Submitting…" : "Sign up"}
          </Button>
          <p className="text-center text-xs text-[var(--color-text-muted)]">
            Already have an account?{" "}
            <Link href="/login" className="text-[var(--color-primary)] underline">
              Sign in
            </Link>
          </p>
        </form>
      </Card>
    </div>
  );
}
