"use client";

import { useState, useCallback, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Input, Card } from "@/components/ui";
import { loginSchema, type LoginFormData } from "@/schemas/user";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (status === "authenticated" && session?.userId) {
      const target =
        callbackUrl.startsWith("/") && !callbackUrl.startsWith("//") && !callbackUrl.includes(":")
          ? callbackUrl
          : "/dashboard";
      router.replace(target);
    }
  }, [status, session?.userId, callbackUrl, router]);
  const errorParam = searchParams.get("error");
  const [error, setError] = useState<string | null>(null);
  const errorFromUrl = errorParam === "CredentialsSignin" ? "Invalid email or password." : null;
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<LoginFormData>({ email: "", password: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof LoginFormData, string>>>({});

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  }, []);

  const doLogin = useCallback(async () => {
    setError(null);
    const parsed = loginSchema.safeParse(formData);
    if (!parsed.success) {
      const fieldErrors: Partial<Record<keyof LoginFormData, string>> = {};
      parsed.error.errors.forEach((err) => {
        const path = err.path[0] as keyof LoginFormData;
        if (path) fieldErrors[path] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setLoading(true);
    // Validate callbackUrl to prevent open redirect (only allow same-origin paths)
    const safeCallbackUrl =
      typeof callbackUrl === "string" &&
      callbackUrl.startsWith("/") &&
      !callbackUrl.startsWith("//") &&
      !callbackUrl.includes(":")
        ? callbackUrl
        : "/dashboard";

    try {
      // redirect: true = NextAuth handles redirect and cookie; browser does full navigation
      const result = await signIn("credentials", {
        email: parsed.data.email,
        password: parsed.data.password,
        callbackUrl: safeCallbackUrl,
        redirect: true,
      });
      // If we get here, sign-in failed (redirect: true means we never return on success)
      if (result?.error) {
        setError("Invalid email or password.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [formData, callbackUrl]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      doLogin();
    },
    [doLogin]
  );

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
        <h1 className="mb-2 text-xl font-bold text-[var(--color-text-dark)]">Sign in</h1>
        <p className="mb-6 text-sm text-[var(--color-text-muted)]">
          Church Ministry Management System
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          {(error ?? errorFromUrl) && (
            <p className="text-sm text-red-600" role="alert">
              {error ?? errorFromUrl}
            </p>
          )}
          <Input
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@church.org"
            value={formData.email}
            onChange={handleChange}
            error={errors.email}
          />
          <Input
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={formData.password}
            onChange={handleChange}
            error={errors.password}
          />
          <Button
            type="submit"
            variant="primary"
            loading={loading}
            className="w-full"
            disabled={loading}
          >
            Sign in
          </Button>
        </form>
        <p className="mt-4 text-sm text-[var(--color-text-muted)]">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-[var(--color-primary)] hover:underline">
            Sign up
          </Link>
        </p>
      </Card>
    </main>
  );
}
