import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { RoleSlug } from "@/lib/permissions";
import { canCreateLineup, canManageMinistry } from "@/lib/permissions";
import { PageContainer, Card, Button } from "@/components/ui";
import { FiPlus } from "react-icons/fi";
import Link from "next/link";
import { LineupTableClient } from "@/features/lineup/LineupTableClient";

const MUSIC_SLUG = "music";

export default async function LineupListPage() {
  const session = await getServerSession(authOptions);
  const userId = (session as { userId?: string })?.userId ?? "";
  const roleSlug = (session as { roleSlug?: RoleSlug })?.roleSlug ?? "user";
  const ministryIds = (session as { ministryIds?: string[] })?.ministryIds ?? [];

  const musicMinistry = await prisma.ministry.findUnique({
    where: { slug: MUSIC_SLUG },
  });
  if (!musicMinistry) {
    return (
      <PageContainer title="Music Lineup">
        <p>Music ministry not found. Please run the database seed.</p>
      </PageContainer>
    );
  }
  const canCreate = canCreateLineup(roleSlug, ministryIds, musicMinistry.id);

  const all = await prisma.lineup.findMany({
    where: { ministryId: musicMinistry.id },
    orderBy: { date: "desc" },
    include: {
      ministry: true,
      createdBy: { select: { name: true } },
      songs: { orderBy: [{ section: "asc" }, { order: "asc" }] },
      instrumentAssignments: {
        include: { instrument: true, user: { select: { id: true, name: true } } },
      },
      singerAssignments: {
        include: { singerRole: true, user: { select: { id: true, name: true } } },
      },
    },
  });
  // Drafts: admin, creator, or ministry head of music can see. Non-drafts: everyone sees.
  const filtered = all.filter((l) => {
    if (l.status !== "Draft") return true;
    if (roleSlug === "admin") return true;
    if (l.createdById === userId) return true;
    if (canManageMinistry(roleSlug, ministryIds, l.ministryId)) return true;
    return false;
  });

  const lineups = filtered.map((l) => {
    const canEdit =
      roleSlug === "admin" ||
      (l.status === "Draft" &&
        (l.createdById === userId || canManageMinistry(roleSlug, ministryIds, l.ministryId))) ||
      (l.status !== "Draft" && canManageMinistry(roleSlug, ministryIds, l.ministryId));
    const canApprove = canManageMinistry(roleSlug, ministryIds, l.ministryId);
    const statusActions: Array<"submit" | "approve"> =
      l.status === "Draft" && canEdit
        ? ["submit"]
        : l.status === "Pending Approval" && canApprove
          ? ["approve"]
          : [];
    return {
      ...l,
      _actions: {
        canEdit,
        canDelete: canEdit,
        canChangeStatus: statusActions.length > 0,
        statusActions,
      },
    };
  });

  return (
    <PageContainer title="Music Lineup" description="Sunday worship lineups">
      {canCreate && (
        <div className="mb-6 flex justify-end">
          <Link href="/dashboard/lineup/new">
            <Button icon={<FiPlus className="size-4" />}>Create lineup</Button>
          </Link>
        </div>
      )}
      <Card>
        <LineupTableClient lineups={lineups} />
      </Card>
    </PageContainer>
  );
}
