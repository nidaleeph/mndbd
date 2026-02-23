import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { canAccessForms } from "@/lib/permissions";
import type { RoleSlug } from "@/lib/permissions";
import { PageContainer, Card } from "@/components/ui";
import { FiFileText } from "react-icons/fi";

export default async function FormsIndexPage() {
  const session = await getServerSession(authOptions);
  const roleSlug = (session as { roleSlug?: RoleSlug })?.roleSlug ?? "user";
  if (!canAccessForms(roleSlug)) redirect("/dashboard");
  return (
    <PageContainer title="Forms" description="Activity and Purchase Request Forms">
      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/dashboard/forms/arf">
          <Card className="cursor-pointer transition hover:ring-2 hover:ring-[var(--color-primary)]">
            <div className="flex items-center gap-3">
              <FiFileText className="size-8 text-[var(--color-primary)]" />
              <div>
                <h2 className="font-semibold text-[var(--color-text-dark)]">
                  Activity Request (ARF)
                </h2>
                <p className="text-sm text-[var(--color-text-muted)]">
                  Submit and manage activity requests
                </p>
              </div>
            </div>
          </Card>
        </Link>
        <Link href="/dashboard/forms/prf">
          <Card className="cursor-pointer transition hover:ring-2 hover:ring-[var(--color-primary)]">
            <div className="flex items-center gap-3">
              <FiFileText className="size-8 text-[var(--color-primary)]" />
              <div>
                <h2 className="font-semibold text-[var(--color-text-dark)]">
                  Purchase Request (PRF)
                </h2>
                <p className="text-sm text-[var(--color-text-muted)]">
                  Submit and manage purchase requests
                </p>
              </div>
            </div>
          </Card>
        </Link>
      </div>
    </PageContainer>
  );
}
