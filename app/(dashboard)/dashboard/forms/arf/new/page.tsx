import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { canCreateDraftARFOrPRF, canCreateARFOrPRF } from "@/lib/permissions";
import type { RoleSlug } from "@/lib/permissions";
import { PageContainer, Card } from "@/components/ui";
import { ARFForm } from "@/features/arf/ARFForm";

export default async function NewARFPage() {
  const session = await getServerSession(authOptions);
  const roleSlug = (session as { roleSlug?: RoleSlug })?.roleSlug ?? "user";
  if (!canCreateDraftARFOrPRF(roleSlug)) {
    redirect("/dashboard/forms/arf");
  }
  const canApprove = canCreateARFOrPRF(roleSlug);
  return (
    <PageContainer title="New Activity Request Form" description="Submit a new ARF">
      <Card>
        <ARFForm canApprove={canApprove} />
      </Card>
    </PageContainer>
  );
}
