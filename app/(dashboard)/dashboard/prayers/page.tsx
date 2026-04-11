import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  canAccessPrayers,
  canManagePrayer,
  canViewAllPrayers,
  type PermissionSession,
} from "@/lib/permissions";
import { getParakletosMinistryId } from "@/lib/checklist";
import { PageContainer, Card, Button } from "@/components/ui";
import { FiPlus } from "react-icons/fi";
import Link from "next/link";
import { PrayerTableClient } from "@/features/prayer/PrayerTableClient";

export default async function PrayersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return (
      <PageContainer title="Prayers">
        <p>You must be signed in.</p>
      </PageContainer>
    );
  }
  const ps: PermissionSession = {
    isAdmin: session.isAdmin,
    ministryIds: session.ministryIds,
    headOfMinistryIds: session.headOfMinistryIds,
  };

  if (!canAccessPrayers()) {
    return (
      <PageContainer title="Prayers">
        <p>You do not have access to this page.</p>
      </PageContainer>
    );
  }

  const parakletosId = await getParakletosMinistryId();
  if (!parakletosId) {
    return (
      <PageContainer title="Prayers">
        <p>Parakletos ministry not found. Please run the database seed.</p>
      </PageContainer>
    );
  }

  const viewAll = canViewAllPrayers(ps, parakletosId);
  const where = viewAll
    ? { ministryId: parakletosId }
    : { ministryId: parakletosId, createdById: session.userId };

  const rawPrayers = await prisma.prayer.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { name: true } } },
  });

  const prayers = rawPrayers.map((p) => {
    const perms = canManagePrayer(ps, parakletosId, p.createdById, session.userId);
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
