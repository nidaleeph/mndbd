import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageMinistry } from "@/lib/permissions";
import type { RoleSlug } from "@/lib/permissions";
import { PageContainer, Card } from "@/components/ui";
import { ARFForm } from "@/features/arf/ARFForm";

export default async function EditARFPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const roleSlug = (session as { roleSlug?: RoleSlug })?.roleSlug ?? "user";
  const ministryIds = (session as { ministryIds?: string[] })?.ministryIds ?? [];
  const sessionUserId = (session as { userId?: string })?.userId;
  const arf = await prisma.aRF.findUnique({ where: { id } });
  if (!arf) redirect("/dashboard/forms/arf");
  // Drafts: only creator or admin can edit. Non-drafts: ministry head can edit.
  const canEditDraft =
    arf.status === "draft" && (arf.createdById === sessionUserId || roleSlug === "admin");
  const canEditNonDraft =
    arf.status !== "draft" && canManageMinistry(roleSlug, ministryIds, arf.ministryId);
  if (!canEditDraft && !canEditNonDraft) redirect("/dashboard/forms/arf");
  const canApprove =
    arf.status !== "draft" && canManageMinistry(roleSlug, ministryIds, arf.ministryId);
  return (
    <PageContainer title="Edit ARF" description={arf.eventName}>
      <Card>
        <ARFForm arfId={id} canApprove={canApprove} />
      </Card>
    </PageContainer>
  );
}
