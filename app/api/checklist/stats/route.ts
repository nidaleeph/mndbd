import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewChecklistHistory, type PermissionSession } from "@/lib/permissions";
import { getMultimediaMinistryId, computeRunProgress } from "@/lib/checklist";

export const dynamic = "force-dynamic";

const HISTORY_WINDOW = 12;

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ps: PermissionSession = {
    isAdmin: session.isAdmin,
    ministryIds: session.ministryIds,
    headOfMinistryIds: session.headOfMinistryIds,
  };
  const multimediaMinistryId = await getMultimediaMinistryId();
  if (!multimediaMinistryId) {
    return NextResponse.json({ error: "Multimedia ministry not found" }, { status: 500 });
  }
  if (!canViewChecklistHistory(ps, multimediaMinistryId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const view = new URL(request.url).searchParams.get("view") ?? "trends";
  if (view !== "trends" && view !== "reliability" && view !== "people") {
    return NextResponse.json({ message: "Invalid view" }, { status: 400 });
  }

  const template = await prisma.checklistTemplate.findUnique({
    where: { ministryId: multimediaMinistryId },
    select: { id: true },
  });
  if (!template) return NextResponse.json({ view, data: [] });

  if (view === "trends") {
    const runs = await prisma.checklistRun.findMany({
      where: { templateId: template.id },
      orderBy: { weekStart: "desc" },
      take: HISTORY_WINDOW,
      include: {
        checks: { select: { itemId: true, checkedAt: true } },
        template: {
          include: {
            categories: { include: { items: { select: { id: true, archivedAt: true } } } },
          },
        },
      },
    });
    const rows = runs
      .map((r) => {
        const items = r.template.categories.flatMap((c) => c.items);
        const { percent } = computeRunProgress(items, r.checks);
        const times = r.checks.map((c) => c.checkedAt.getTime());
        const durationMinutes =
          times.length >= 2 ? Math.round((Math.max(...times) - Math.min(...times)) / 60000) : 0;
        return { runId: r.id, weekStart: r.weekStart, percent, durationMinutes };
      })
      .reverse();
    return NextResponse.json({ view, data: rows });
  }

  if (view === "reliability") {
    const recentRuns = await prisma.checklistRun.findMany({
      where: { templateId: template.id },
      orderBy: { weekStart: "desc" },
      take: HISTORY_WINDOW,
      select: { id: true, startedAt: true },
    });
    const runIds = recentRuns.map((r) => r.id);

    const items = await prisma.checklistItem.findMany({
      where: { archivedAt: null, category: { templateId: template.id } },
      include: {
        category: { select: { name: true } },
        checks: { where: { runId: { in: runIds } }, select: { runId: true } },
      },
    });

    const rows = items.map((item) => {
      const eligibleRuns = recentRuns.filter((r) => r.startedAt >= item.createdAt).length;
      const checkedRunIds = new Set(item.checks.map((c) => c.runId));
      const timesChecked = checkedRunIds.size;
      const timesMissed = Math.max(0, eligibleRuns - timesChecked);
      const missRate = eligibleRuns === 0 ? 0 : timesMissed / eligibleRuns;
      return {
        itemId: item.id,
        category: item.category.name,
        label: item.label,
        timesChecked,
        timesMissed,
        missRate: Math.round(missRate * 1000) / 10,
      };
    });
    rows.sort((a, b) => b.missRate - a.missRate);
    return NextResponse.json({ view, data: rows });
  }

  // view === "people"
  const recentRuns = await prisma.checklistRun.findMany({
    where: { templateId: template.id },
    orderBy: { weekStart: "desc" },
    take: HISTORY_WINDOW,
    select: { id: true },
  });
  const runIds = recentRuns.map((r) => r.id);

  const checksByUser = await prisma.itemCheck.findMany({
    where: { runId: { in: runIds } },
    include: { checkedBy: { select: { id: true, name: true } } },
  });

  const byUser = new Map<
    string,
    { userId: string; name: string; runs: Set<string>; total: number; last: Date }
  >();
  for (const c of checksByUser) {
    const existing = byUser.get(c.checkedById);
    if (existing) {
      existing.runs.add(c.runId);
      existing.total += 1;
      if (c.checkedAt > existing.last) existing.last = c.checkedAt;
    } else {
      byUser.set(c.checkedById, {
        userId: c.checkedById,
        name: c.checkedBy.name,
        runs: new Set([c.runId]),
        total: 1,
        last: c.checkedAt,
      });
    }
  }

  const rows = Array.from(byUser.values())
    .map((u) => ({
      userId: u.userId,
      name: u.name,
      runsParticipated: u.runs.size,
      totalRuns: recentRuns.length,
      totalChecked: u.total,
      avgPerRun: u.runs.size === 0 ? 0 : Math.round((u.total / u.runs.size) * 10) / 10,
      lastActive: u.last.toISOString(),
    }))
    .sort((a, b) => b.totalChecked - a.totalChecked);

  return NextResponse.json({ view, data: rows });
}
