import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { RoleSlug } from "@/lib/permissions";
import { canCreateLineup, canManageMinistry } from "@/lib/permissions";
import { PageContainer, Card } from "@/components/ui";
import { LineupForm } from "@/features/lineup/LineupForm";

const MUSIC_SLUG = "music";

export default async function NewLineupPage() {
  const session = await getServerSession(authOptions);
  const roleSlug = (session as { roleSlug?: RoleSlug })?.roleSlug ?? "user";
  const ministryIds = (session as { ministryIds?: string[] })?.ministryIds ?? [];

  const musicMinistry = await prisma.ministry.findUnique({
    where: { slug: MUSIC_SLUG },
  });
  if (!musicMinistry) redirect("/dashboard/lineup");
  if (!canCreateLineup(roleSlug, ministryIds, musicMinistry.id)) {
    redirect("/dashboard/lineup");
  }

  const canApprove = canManageMinistry(roleSlug, ministryIds, musicMinistry.id);
  const canSubmitForApproval = true;

  return (
    <PageContainer title="New lineup" description="Create a Sunday worship lineup">
      <Card>
        <LineupForm
          musicMinistryId={musicMinistry.id}
          canApprove={canApprove}
          canSubmitForApproval={canSubmitForApproval}
        />
      </Card>
    </PageContainer>
  );
}
