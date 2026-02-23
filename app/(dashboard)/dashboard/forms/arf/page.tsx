import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { RoleSlug } from "@/lib/permissions";
import { canAccessForms, canManageMinistry } from "@/lib/permissions";
import { PageContainer, Card, Button } from "@/components/ui";
import { FiPlus } from "react-icons/fi";
import Link from "next/link";
import { ARFTableClient } from "@/features/arf/ARFTableClient";

export default async function ARFListPage() {
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
  const rawArfs = await prisma.aRF.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { ministry: true, createdBy: { select: { name: true } } },
  });

  // Enrich each row with role-based actions
  const arfs = rawArfs.map((arf) => {
    const canEdit =
      (arf.status === "draft" && arf.createdById === userId) ||
      (arf.status !== "draft" && canManageMinistry(roleSlug, ministryIds, arf.ministryId));
    const statusActions: Array<"submit" | "approve" | "reject"> =
      arf.status === "draft" && canEdit
        ? ["submit"]
        : arf.status === "pending" && canEdit
          ? ["approve", "reject"]
          : [];
    return {
      ...arf,
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
      title="Activity Request Forms (ARF)"
      description="Create and manage activity requests"
    >
      <div className="mb-6 flex justify-end">
        <Link href="/dashboard/forms/arf/new">
          <Button icon={<FiPlus className="size-4" />}>Create ARF</Button>
        </Link>
      </div>
      <Card>
        <ARFTableClient arfs={arfs} />
      </Card>
    </PageContainer>
  );
}
