import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { RoleSlug } from "@/lib/permissions";
import { canAccessPrayers, canManagePrayer, canViewAllPrayers } from "@/lib/permissions";
import { PageContainer, Card, Button } from "@/components/ui";
import { FiPlus } from "react-icons/fi";
import Link from "next/link";
import { PrayerTableClient } from "@/features/prayer/PrayerTableClient";

const PARAKLETOS_SLUG = "parakletos";

export default async function PrayersPage() {
  const session = await getServerSession(authOptions);
  const roleSlug = (session as { roleSlug?: RoleSlug })?.roleSlug ?? "user";
  const ministryIds = (session as { ministryIds?: string[] })?.ministryIds ?? [];

  if (!canAccessPrayers(roleSlug)) {
    return (
      <PageContainer title="Prayers">
        <p>You do not have access to this page.</p>
      </PageContainer>
    );
  }

  const parakletos = await prisma.ministry.findUnique({
    where: { slug: PARAKLETOS_SLUG },
  });
  if (!parakletos) {
    return (
      <PageContainer title="Prayers">
        <p>Parakletos ministry not found. Please run the database seed.</p>
      </PageContainer>
    );
  }

  const viewAll = canViewAllPrayers(roleSlug, ministryIds, parakletos.id);
  const where = viewAll
    ? { ministryId: parakletos.id }
    : { ministryId: parakletos.id, createdById: session?.userId ?? "" };

  const rawPrayers = await prisma.prayer.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { name: true } } },
  });

  const prayers = rawPrayers.map((p) => {
    const perms = canManagePrayer(
      roleSlug,
      ministryIds,
      parakletos.id,
      p.createdById,
      session?.userId ?? ""
    );
    return {
      ...p,
      createdAt: p.createdAt.toISOString(),
      _actions: {
        canEdit: perms.canEdit,
        canDelete: perms.canDelete,
        canSetStatus: perms.canSetStatus,
      },
    };
  });

  return (
    <PageContainer title="Prayers" description="Prayer requests and intercession">
      <div className="mb-6 flex justify-end">
        <Link href="/dashboard/prayers/new">
          <Button icon={<FiPlus className="size-4" />}>Add prayer</Button>
        </Link>
      </div>
      <Card>
        <PrayerTableClient prayers={prayers} />
      </Card>
    </PageContainer>
  );
}
