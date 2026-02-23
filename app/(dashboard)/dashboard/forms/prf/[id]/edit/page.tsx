import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageMinistry } from "@/lib/permissions";
import type { RoleSlug } from "@/lib/permissions";
import { PageContainer, Card } from "@/components/ui";
import { PRFForm } from "@/features/prf/PRFForm";

export default async function EditPRFPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const roleSlug = (session as { roleSlug?: RoleSlug })?.roleSlug ?? "user";
  const ministryIds = (session as { ministryIds?: string[] })?.ministryIds ?? [];
  const sessionUserId = (session as { userId?: string })?.userId;
  const prf = await prisma.pRF.findUnique({ where: { id } });
  if (!prf) redirect("/dashboard/forms/prf");
  // Drafts: only creator or admin can edit. Non-drafts: ministry head can edit.
  const canEditDraft =
    prf.status === "draft" && (prf.createdById === sessionUserId || roleSlug === "admin");
  const canEditNonDraft =
    prf.status !== "draft" && canManageMinistry(roleSlug, ministryIds, prf.ministryId);
  if (!canEditDraft && !canEditNonDraft) redirect("/dashboard/forms/prf");
  const canApprove =
    prf.status !== "draft" && canManageMinistry(roleSlug, ministryIds, prf.ministryId);
  return (
    <PageContainer title="Edit PRF" description={prf.purpose}>
      <Card>
        <PRFForm prfId={id} canApprove={canApprove} />
      </Card>
    </PageContainer>
  );
}
