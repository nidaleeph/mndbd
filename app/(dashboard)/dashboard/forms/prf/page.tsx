import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { RoleSlug } from "@/lib/permissions";
import { canAccessForms, canManageMinistry } from "@/lib/permissions";
import { PageContainer, Card, Button } from "@/components/ui";
import { FiPlus } from "react-icons/fi";
import Link from "next/link";
import { PRFTableClient } from "@/features/prf/PRFTableClient";

export default async function PRFListPage() {
  const session = await getServerSession(authOptions);
  const roleSlug = (session as { roleSlug?: RoleSlug })?.roleSlug ?? "user";
  const ministryIds = (session as { ministryIds?: string[] })?.ministryIds ?? [];

  if (!canAccessForms(roleSlug)) {
    return (
      <PageContainer title="Forms">
        <p>You do not have access to this page.</p>
      </PageContainer>
    );
  }

  const userId = (session as { userId?: string })?.userId ?? "";
  const where =
    roleSlug === "admin"
      ? {}
      : roleSlug === "ministry_head"
        ? ministryIds.length > 0
          ? { ministryId: { in: ministryIds }, status: { not: "draft" } }
          : { ministryId: "none" }
        : ministryIds.length > 0
          ? {
              OR: [
                { createdById: userId },
                { status: { not: "draft" }, ministryId: { in: ministryIds } },
              ],
            }
          : { createdById: userId };
  const rawPrfs = await prisma.pRF.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { ministry: true, createdBy: { select: { name: true } } },
  });

  const prfs = rawPrfs.map((prf) => {
    const canEdit =
      (prf.status === "draft" && prf.createdById === userId) ||
      (prf.status !== "draft" && canManageMinistry(roleSlug, ministryIds, prf.ministryId));
    const statusActions: Array<"submit" | "approve" | "reject"> =
      prf.status === "draft" && canEdit
        ? ["submit"]
        : prf.status === "pending" && canEdit
          ? ["approve", "reject"]
          : [];
    return {
      ...prf,
      amountRequested: Number(prf.amountRequested),
      _actions: {
        canEdit,
        canDelete: canEdit,
        canChangeStatus: statusActions.length > 0,
        statusActions,
      },
    };
  });

  return (
    <PageContainer
      title="Purchase Request Forms (PRF)"
      description="Create and manage purchase requests"
    >
      <div className="mb-6 flex justify-end">
        <Link href="/dashboard/forms/prf/new">
          <Button icon={<FiPlus className="size-4" />}>Create PRF</Button>
        </Link>
      </div>
      <Card>
        <PRFTableClient prfs={prfs} />
      </Card>
    </PageContainer>
  );
}
