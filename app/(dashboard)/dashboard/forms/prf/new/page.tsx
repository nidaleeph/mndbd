import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { canCreateDraftARFOrPRF, canCreateARFOrPRF } from "@/lib/permissions";
import type { RoleSlug } from "@/lib/permissions";
import { PageContainer, Card } from "@/components/ui";
import { PRFForm } from "@/features/prf/PRFForm";

export default async function NewPRFPage() {
  const session = await getServerSession(authOptions);
  const roleSlug = (session as { roleSlug?: RoleSlug })?.roleSlug ?? "user";
  if (!canCreateDraftARFOrPRF(roleSlug)) {
    redirect("/dashboard/forms/prf");
  }
  const canApprove = canCreateARFOrPRF(roleSlug);
  return (
    <PageContainer title="New Purchase Request Form" description="Submit a new PRF">
      <Card>
        <PRFForm canApprove={canApprove} />
      </Card>
    </PageContainer>
  );
}
