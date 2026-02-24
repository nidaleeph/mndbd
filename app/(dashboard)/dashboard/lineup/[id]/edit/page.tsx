import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { RoleSlug } from "@/lib/permissions";
import { canManageMinistry, canSeeDraftLineup } from "@/lib/permissions";
import { PageContainer, Card } from "@/components/ui";
import { LineupForm } from "@/features/lineup/LineupForm";

export default async function EditLineupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const userId = (session as { userId?: string })?.userId ?? "";
  const roleSlug = (session as { roleSlug?: RoleSlug })?.roleSlug ?? "user";
  const ministryIds = (session as { ministryIds?: string[] })?.ministryIds ?? [];
  const lineup = await prisma.lineup.findUnique({ where: { id } });
  if (!lineup) redirect("/dashboard/lineup");
  const canEditDraft =
    canSeeDraftLineup(roleSlug, lineup.createdById, lineup.ministryId, userId, ministryIds) ||
    canManageMinistry(roleSlug, ministryIds, lineup.ministryId);
  const canEditNonDraft = canManageMinistry(roleSlug, ministryIds, lineup.ministryId);
  const canEdit = lineup.status === "Draft" ? canEditDraft : canEditNonDraft;
  if (!canEdit) redirect("/dashboard/lineup");
  const canApprove = canManageMinistry(roleSlug, ministryIds, lineup.ministryId);
  return (
    <PageContainer title="Edit lineup" description={lineup.eventName}>
      <Card>
        <LineupForm lineupId={id} canApprove={canApprove} />
      </Card>
    </PageContainer>
  );
}
