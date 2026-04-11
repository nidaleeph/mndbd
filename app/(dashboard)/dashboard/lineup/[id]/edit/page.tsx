import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canApproveLineup, canSeeDraftLineup, type PermissionSession } from "@/lib/permissions";
import { getMusicMinistryId } from "@/lib/checklist";
import { PageContainer, Card } from "@/components/ui";
import { LineupForm } from "@/features/lineup/LineupForm";

export default async function EditLineupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/login");
  const userId = session.userId;
  const ps: PermissionSession = {
    isAdmin: session.isAdmin,
    ministryIds: session.ministryIds,
    headOfMinistryIds: session.headOfMinistryIds,
  };
  const musicMinistryId = await getMusicMinistryId();
  if (!musicMinistryId) redirect("/dashboard/lineup");
  const lineup = await prisma.lineup.findUnique({ where: { id } });
  if (!lineup) redirect("/dashboard/lineup");
  const canEditDraft =
    canSeeDraftLineup(ps, lineup.createdById, userId) || canApproveLineup(ps, musicMinistryId);
  const canEditNonDraft = canApproveLineup(ps, musicMinistryId);
  const canEdit = lineup.status === "Draft" ? canEditDraft : canEditNonDraft;
  if (!canEdit) redirect("/dashboard/lineup");
  const canApprove = canApproveLineup(ps, musicMinistryId);
  return (
    <PageContainer title="Edit lineup" description={lineup.eventName}>
      <Card>
        <LineupForm lineupId={id} canApprove={canApprove} />
      </Card>
    </PageContainer>
  );
}
