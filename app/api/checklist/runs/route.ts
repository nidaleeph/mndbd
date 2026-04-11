import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewChecklistHistory, type RoleSlug } from "@/lib/permissions";
import { getMultimediaMinistryId, computeRunProgress } from "@/lib/checklist";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const roleSlug = (session.roleSlug ?? "user") as RoleSlug;
  const ministryIds = session.ministryIds ?? [];
  const multimediaMinistryId = await getMultimediaMinistryId();
  if (!multimediaMinistryId) {
    return NextResponse.json({ error: "Multimedia ministry not found" }, { status: 500 });
  }
  if (!canViewChecklistHistory(roleSlug, ministryIds, multimediaMinistryId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 20), 100);
  const cursor = url.searchParams.get("cursor");

  const template = await prisma.checklistTemplate.findUnique({
    where: { ministryId: multimediaMinistryId },
    select: { id: true },
  });
  if (!template) return NextResponse.json({ runs: [], nextCursor: null });

  const runs = await prisma.checklistRun.findMany({
    where: { templateId: template.id },
    orderBy: { weekStart: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      startedBy: { select: { id: true, name: true } },
      closedBy: { select: { id: true, name: true } },
      checks: { select: { itemId: true, checkedAt: true } },
      template: {
        include: {
          categories: {
            include: { items: { select: { id: true, archivedAt: true, createdAt: true } } },
          },
        },
      },
    },
  });

  const hasMore = runs.length > limit;
  const rows = hasMore ? runs.slice(0, limit) : runs;

  const shaped = rows.map((run) => {
    const allItems = run.template.categories.flatMap((c) => c.items);
    const { total, complete, percent } = computeRunProgress(allItems, run.checks);
    const midServiceAdds = allItems.filter((i) => i.createdAt > run.startedAt).length;
    const times = run.checks.map((c) => c.checkedAt.getTime());
    const durationMs = times.length >= 2 ? Math.max(...times) - Math.min(...times) : 0;
    return {
      id: run.id,
      weekStart: run.weekStart,
      startedAt: run.startedAt,
      closedAt: run.closedAt,
      startedBy: run.startedBy?.name ?? null,
      closedBy: run.closedBy?.name ?? null,
      total,
      complete,
      percent,
      midServiceAdds,
      durationMs,
    };
  });

  return NextResponse.json({
    runs: shaped,
    nextCursor: hasMore ? rows[rows.length - 1].id : null,
  });
}
