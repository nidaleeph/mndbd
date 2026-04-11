import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { SignOutButton } from "./SignOutButton";

export const dynamic = "force-dynamic";

export default async function PendingPage() {
  const session = await getServerSession(authOptions);

  if (!session?.userId) {
    redirect("/login");
  }
  if (session.status === "active") {
    redirect("/dashboard");
  }
  if (session.status === "inactive") {
    redirect("/login?error=inactive");
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg border border-[var(--color-border)] bg-[var(--color-card-bg)] p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-soft-blue-bg)]">
          <span className="text-xl">⏳</span>
        </div>
        <h1 className="mb-2 text-xl font-semibold text-[var(--color-text-dark)]">
          Account pending approval
        </h1>
        <p className="mb-6 text-sm text-[var(--color-text-muted)]">
          Thanks for signing up. An admin will review your account shortly. You&apos;ll be able to
          sign in once your account is approved.
        </p>
        <p className="mb-6 text-xs text-[var(--color-text-muted)]">
          For questions, please contact your church admin directly.
        </p>
        <SignOutButton />
      </div>
    </div>
  );
}
