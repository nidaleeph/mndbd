import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { RoleSlug } from "@/lib/permissions";
import { canAccessPrayers, canManagePrayer, canViewAllPrayers } from "@/lib/permissions";
import { PageContainer, Card } from "@/components/ui";
import { PrayerForm } from "@/features/prayer/PrayerForm";

const PARAKLETOS_SLUG = "parakletos";

export default async function EditPrayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const roleSlug = (session as { roleSlug?: RoleSlug })?.roleSlug ?? "user";
  const ministryIds = (session as { ministryIds?: string[] })?.ministryIds ?? [];

  if (!canAccessPrayers(roleSlug)) redirect("/dashboard/prayers");

  const prayer = await prisma.prayer.findUnique({
    where: { id },
    include: { ministry: true },
  });
  if (!prayer) redirect("/dashboard/prayers");

  const parakletos = await prisma.ministry.findUnique({
    where: { slug: PARAKLETOS_SLUG },
  });
  if (!parakletos || prayer.ministryId !== parakletos.id) redirect("/dashboard/prayers");

  const viewAll = canViewAllPrayers(roleSlug, ministryIds, parakletos.id);
  const perms = canManagePrayer(
    roleSlug,
    ministryIds,
    parakletos.id,
    prayer.createdById,
    session?.userId ?? ""
  );

  if (!perms.canEdit && !viewAll) redirect("/dashboard/prayers");

  return (
    <PageContainer title="Edit prayer" description={prayer.title}>
      <Card>
        <PrayerForm prayerId={id} />
      </Card>
    </PageContainer>
  );
}
