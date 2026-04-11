import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { canApproveLineup, canCreateLineup, type PermissionSession } from "@/lib/permissions";
import { getMusicMinistryId } from "@/lib/checklist";
import { PageContainer, Card } from "@/components/ui";
import { LineupForm } from "@/features/lineup/LineupForm";

export default async function NewLineupPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/login");
  const ps: PermissionSession = {
    isAdmin: session.isAdmin,
    ministryIds: session.ministryIds,
    headOfMinistryIds: session.headOfMinistryIds,
  };

  const musicMinistryId = await getMusicMinistryId();
  if (!musicMinistryId) redirect("/dashboard/lineup");
  if (!canCreateLineup(ps, musicMinistryId)) {
    redirect("/dashboard/lineup");
  }

  const canApprove = canApproveLineup(ps, musicMinistryId);
  const canSubmitForApproval = true;

  return (
    <PageContainer title="New lineup" description="Create a Sunday worship lineup">
      <Card>
        <LineupForm
          musicMinistryId={musicMinistryId}
          canApprove={canApprove}
          canSubmitForApproval={canSubmitForApproval}
        />
      </Card>
    </PageContainer>
  );
}
