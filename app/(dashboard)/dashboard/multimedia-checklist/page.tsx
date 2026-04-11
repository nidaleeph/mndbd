import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  canViewChecklistHistory,
  canEditChecklistTemplate,
  type PermissionSession,
} from "@/lib/permissions";
import { getMultimediaMinistryId, computeRunProgress } from "@/lib/checklist";
import { ChecklistLandingClient } from "@/features/checklist/ChecklistLandingClient";

export const dynamic = "force-dynamic";

export default async function MultimediaChecklistLanding() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/login?callbackUrl=/dashboard/multimedia-checklist");

  const multimediaMinistryId = await getMultimediaMinistryId();
  if (!multimediaMinistryId) {
    return <div className="p-page">Multimedia ministry not configured.</div>;
  }

  const ps: PermissionSession = {
    isAdmin: session.isAdmin,
    ministryIds: session.ministryIds,
    headOfMinistryIds: session.headOfMinistryIds,
  };
  if (!canViewChecklistHistory(ps, multimediaMinistryId)) {
    redirect("/dashboard");
  }

  const canManage = canEditChecklistTemplate(ps, multimediaMinistryId);

  const template = await prisma.checklistTemplate.findUnique({
    where: { ministryId: multimediaMinistryId },
    include: {
      categories: {
        where: { archivedAt: null },
        include: { items: { where: { archivedAt: null } } },
      },
    },
  });

  // `run.checks` here is capped to 10 rows and is used ONLY for the "Recent activity"
  // feed. Progress is computed below from a separate unlimited query to avoid the
  // 10-row cap silently under-reporting completion.
  const run = template
    ? await prisma.checklistRun.findFirst({
        where: { templateId: template.id, closedAt: null },
        orderBy: { startedAt: "desc" },
        include: {
          startedBy: { select: { name: true } },
          checks: {
            orderBy: { checkedAt: "desc" },
            take: 10,
            include: { checkedBy: { select: { name: true } } },
          },
        },
      })
    : null;

  // Full check list (itemIds only) for progress math — no cap.
  const allChecksForProgress = run
    ? await prisma.itemCheck.findMany({
        where: { runId: run.id },
        select: { itemId: true },
      })
    : [];

  const items = template?.categories.flatMap((c) => c.items) ?? [];
  const progress = run
    ? computeRunProgress(items, allChecksForProgress)
    : { total: 0, complete: 0, percent: 0 };

  // Last 4 runs average completion
  const recentRuns = template
    ? await prisma.checklistRun.findMany({
        where: { templateId: template.id, closedAt: { not: null } },
        orderBy: { weekStart: "desc" },
        take: 4,
        include: {
          checks: { select: { itemId: true } },
          template: {
            include: {
              categories: { include: { items: { select: { id: true, archivedAt: true } } } },
            },
          },
        },
      })
    : [];
  const avgRecent =
    recentRuns.length === 0
      ? 0
      : Math.round(
          recentRuns
            .map((r) => {
              const rItems = r.template.categories.flatMap((c) => c.items);
              return computeRunProgress(rItems, r.checks).percent;
            })
            .reduce((a, b) => a + b, 0) / recentRuns.length
        );

  // Count distinct checkers on the current run — separate query so the recent-activity
  // `run.checks` (limited to 10) doesn't skew this number.
  const activeMembers = run
    ? (
        await prisma.itemCheck.findMany({
          where: { runId: run.id },
          distinct: ["checkedById"],
          select: { checkedById: true },
        })
      ).length
    : 0;

  return (
    <ChecklistLandingClient
      canManage={canManage}
      run={
        run
          ? {
              id: run.id,
              weekStart: run.weekStart.toISOString(),
              startedAt: run.startedAt.toISOString(),
              startedByName: run.startedBy?.name ?? null,
            }
          : null
      }
      progress={progress}
      avgRecent={avgRecent}
      activeMembers={activeMembers}
      recentActivity={
        run?.checks.map((c) => ({
          checkedAt: c.checkedAt.toISOString(),
          checkedByName: c.checkedBy.name,
          label: c.labelSnapshot,
        })) ?? []
      }
    />
  );
}
