import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  canAccessPrayers,
  canManagePrayer,
  canViewAllPrayers,
  type PermissionSession,
} from "@/lib/permissions";
import { getParakletosMinistryId } from "@/lib/checklist";
import { PageContainer, Card } from "@/components/ui";
import { PrayerForm } from "@/features/prayer/PrayerForm";

export default async function EditPrayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/login");
  const ps: PermissionSession = {
    isAdmin: session.isAdmin,
    ministryIds: session.ministryIds,
    headOfMinistryIds: session.headOfMinistryIds,
  };

  if (!canAccessPrayers()) redirect("/dashboard/prayers");

  const prayer = await prisma.prayer.findUnique({
    where: { id },
    include: { ministry: true },
  });
  if (!prayer) redirect("/dashboard/prayers");

  const parakletosId = await getParakletosMinistryId();
  if (!parakletosId || prayer.ministryId !== parakletosId) redirect("/dashboard/prayers");

  const viewAll = canViewAllPrayers(ps, parakletosId);
  const perms = canManagePrayer(ps, parakletosId, prayer.createdById, session.userId);

  if (!perms.canEdit && !viewAll) redirect("/dashboard/prayers");

  return (
    <PageContainer title="Edit prayer" description={prayer.title}>
      <Card>
        <PrayerForm prayerId={id} />
      </Card>
    </PageContainer>
  );
}
