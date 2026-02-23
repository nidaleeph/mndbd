import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import type { RoleSlug } from "@/lib/permissions";
import { PageContainer, Card, Section } from "@/components/ui";

/**
 * Placeholder Reports page. Visible to admins from the sidebar.
 * Can be extended later with ministry reports, lineup stats, etc.
 */
export default async function ReportsPage() {
  const session = await getServerSession(authOptions);
  const roleSlug = (session as { roleSlug?: RoleSlug })?.roleSlug ?? "user";
  if (roleSlug !== "admin") {
    redirect("/dashboard");
  }

  return (
    <PageContainer title="Reports" description="Ministry and system reports">
      <Section title="Reports">
        <Card>
          <p className="text-[var(--color-text-muted)]">
            Reports and analytics will be available here. Check back later.
          </p>
        </Card>
      </Section>
    </PageContainer>
  );
}
