import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMultimediaMinistryId } from "@/lib/checklist";

export const dynamic = "force-dynamic";

/**
 * Public endpoint — no auth. Returns the current Multimedia run (or null),
 * the live template (categories + non-archived items), and all ItemCheck rows
 * for the current run. Public page and admin landing both hydrate from this.
 */
export async function GET() {
  const ministryId = await getMultimediaMinistryId();
  if (!ministryId) {
    return NextResponse.json({ error: "Multimedia ministry not found" }, { status: 500 });
  }

  const template = await prisma.checklistTemplate.findUnique({
    where: { ministryId },
    include: {
      categories: {
        where: { archivedAt: null },
        orderBy: { sortOrder: "asc" },
        include: {
          items: {
            where: { archivedAt: null },
            orderBy: { sortOrder: "asc" },
          },
        },
      },
    },
  });

  if (!template) {
    return NextResponse.json({ run: null, template: null, checks: [] });
  }

  const run = await prisma.checklistRun.findFirst({
    where: { templateId: template.id, closedAt: null },
    orderBy: { startedAt: "desc" },
  });

  const checks = run
    ? await prisma.itemCheck.findMany({
        where: { runId: run.id },
        include: { checkedBy: { select: { id: true, name: true } } },
      })
    : [];

  return NextResponse.json({
    run,
    template,
    checks: checks.map((c) => ({
      id: c.id,
      itemId: c.itemId,
      checkedById: c.checkedById,
      checkedByName: c.checkedBy.name,
      checkedAt: c.checkedAt.toISOString(),
    })),
  });
}
