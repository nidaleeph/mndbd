import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  canApproveLineup,
  canCreateLineup,
  canSeeDraftLineup,
  type PermissionSession,
} from "@/lib/permissions";
import { getMusicMinistryId } from "@/lib/checklist";
import { PageContainer, Card, Button } from "@/components/ui";
import { FiPlus } from "react-icons/fi";
import Link from "next/link";
import { LineupTableClient } from "@/features/lineup/LineupTableClient";

export default async function LineupListPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return (
      <PageContainer title="Music Lineup">
        <p>You must be signed in.</p>
      </PageContainer>
    );
  }
  const userId = session.userId;
  const ps: PermissionSession = {
    isAdmin: session.isAdmin,
    ministryIds: session.ministryIds,
    headOfMinistryIds: session.headOfMinistryIds,
  };

  const musicMinistryId = await getMusicMinistryId();
  if (!musicMinistryId) {
    return (
      <PageContainer title="Music Lineup">
        <p>Music ministry not found. Please run the database seed.</p>
      </PageContainer>
    );
  }
  const canCreate = canCreateLineup(ps, musicMinistryId);

  const all = await prisma.lineup.findMany({
    where: { ministryId: musicMinistryId },
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
  // Drafts: admin, creator, or Music head can see. Non-drafts: everyone sees.
  const filtered = all.filter((l) => {
    if (l.status !== "Draft") return true;
    if (canSeeDraftLineup(ps, l.createdById, userId)) return true;
    if (canApproveLineup(ps, musicMinistryId)) return true;
    return false;
  });

  const lineups = filtered.map((l) => {
    const canEdit =
      (l.status === "Draft" &&
        (canSeeDraftLineup(ps, l.createdById, userId) || canApproveLineup(ps, musicMinistryId))) ||
      (l.status !== "Draft" && canApproveLineup(ps, musicMinistryId));
    const canApprove = canApproveLineup(ps, musicMinistryId);
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
