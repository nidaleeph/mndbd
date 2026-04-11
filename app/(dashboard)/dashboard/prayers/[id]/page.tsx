import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import {
  canAccessPrayers,
  canManagePrayer,
  canViewAllPrayers,
  type PermissionSession,
} from "@/lib/permissions";
import { getParakletosMinistryId } from "@/lib/checklist";
import { PageContainer, Card, Section, Badge } from "@/components/ui";
import { PrayerDetailActions } from "@/features/prayer/PrayerDetailActions";

export default async function PrayerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.userId) notFound();
  const ps: PermissionSession = {
    isAdmin: session.isAdmin,
    ministryIds: session.ministryIds,
    headOfMinistryIds: session.headOfMinistryIds,
  };

  if (!canAccessPrayers()) notFound();

  const prayer = await prisma.prayer.findUnique({
    where: { id },
    include: { createdBy: { select: { name: true } }, ministry: true },
  });
  if (!prayer) notFound();

  const parakletosId = await getParakletosMinistryId();
  if (!parakletosId || prayer.ministryId !== parakletosId) notFound();

  const viewAll = canViewAllPrayers(ps, parakletosId);
  if (!viewAll && prayer.createdById !== session.userId) notFound();

  const perms = canManagePrayer(ps, parakletosId, prayer.createdById, session.userId);

  return (
    <PageContainer title={prayer.title} description={`Prayer · ${prayer.status}`}>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Badge variant={prayer.status === "prayed_for" ? "success" : "default"}>
          {prayer.status === "prayed_for" ? "Prayed for" : "Pending"}
        </Badge>
        <PrayerDetailActions
          prayerId={id}
          canEdit={perms.canEdit}
          canDelete={perms.canDelete}
          canSetStatus={perms.canSetStatus}
        />
      </div>
      <Section title="Details">
        <Card>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-[var(--color-text-muted)]">Title</dt>
              <dd>{prayer.title}</dd>
            </div>
            <div>
              <dt className="text-sm text-[var(--color-text-muted)]">Created by</dt>
              <dd>{prayer.createdBy.name}</dd>
            </div>
            {prayer.description && (
              <div className="sm:col-span-2">
                <dt className="text-sm text-[var(--color-text-muted)]">Description</dt>
                <dd className="mt-1 whitespace-pre-wrap">{prayer.description}</dd>
              </div>
            )}
          </dl>
        </Card>
      </Section>
    </PageContainer>
  );
}
