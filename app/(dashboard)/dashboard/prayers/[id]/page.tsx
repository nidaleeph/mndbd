import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import type { RoleSlug } from "@/lib/permissions";
import { canAccessPrayers, canManagePrayer, canViewAllPrayers } from "@/lib/permissions";
import { PageContainer, Card, Section, Badge } from "@/components/ui";
import { PrayerDetailActions } from "@/features/prayer/PrayerDetailActions";

const PARAKLETOS_SLUG = "parakletos";

export default async function PrayerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const roleSlug = (session as { roleSlug?: RoleSlug })?.roleSlug ?? "user";
  const ministryIds = (session as { ministryIds?: string[] })?.ministryIds ?? [];

  if (!canAccessPrayers(roleSlug)) notFound();

  const prayer = await prisma.prayer.findUnique({
    where: { id },
    include: { createdBy: { select: { name: true } }, ministry: true },
  });
  if (!prayer) notFound();

  const parakletos = await prisma.ministry.findUnique({
    where: { slug: PARAKLETOS_SLUG },
  });
  if (!parakletos || prayer.ministryId !== parakletos.id) notFound();

  const viewAll = canViewAllPrayers(roleSlug, ministryIds, parakletos.id);
  if (!viewAll && prayer.createdById !== session?.userId) notFound();

  const perms = canManagePrayer(
    roleSlug,
    ministryIds,
    parakletos.id,
    prayer.createdById,
    session?.userId ?? ""
  );

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
