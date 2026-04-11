import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getMultimediaMinistryId,
  computeCurrentWeekSundayManila,
  startOfTodayManila,
  computeRunProgress,
  getRunClosedRecipients,
} from "@/lib/checklist";
import { createNotificationsForUserIds } from "@/services/notificationService";
import { publishRunChanged } from "@/services/checklistEvents";
import { formatManilaDate } from "@/lib/dates";

export const dynamic = "force-dynamic";

/**
 * Cron endpoint — idempotent, safe to run repeatedly.
 * Matches the Authorization: Bearer $CRON_SECRET pattern from /api/cron/reminders.
 * See spec §8.1 for the logic contract.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const multimediaMinistryId = await getMultimediaMinistryId();
  if (!multimediaMinistryId) {
    return NextResponse.json({ error: "Multimedia ministry not found" }, { status: 500 });
  }

  const template = await prisma.checklistTemplate.findUnique({
    where: { ministryId: multimediaMinistryId },
    select: { id: true },
  });
  if (!template) {
    return NextResponse.json({ closed: 0, started: null, message: "No template" });
  }

  const todayStart = startOfTodayManila();
  const upcoming = computeCurrentWeekSundayManila();
  const closed: string[] = [];
  let started: string | null = null;

  // 1. Close all open runs whose weekStart has already passed.
  const openRuns = await prisma.checklistRun.findMany({
    where: { templateId: template.id, closedAt: null },
  });
  for (const run of openRuns) {
    if (run.weekStart < todayStart) {
      await prisma.checklistRun.update({
        where: { id: run.id },
        data: { closedAt: new Date(), closedById: null },
      });
      await publishRunChanged("closed", run.id);
      closed.push(run.id);

      const closedTemplate = await prisma.checklistTemplate.findUnique({
        where: { id: run.templateId },
        include: {
          categories: { include: { items: { select: { id: true, archivedAt: true } } } },
        },
      });
      const closedChecks = await prisma.itemCheck.findMany({
        where: { runId: run.id },
        select: { itemId: true },
      });
      const closedItems = closedTemplate?.categories.flatMap((c) => c.items) ?? [];
      const closedProgress = computeRunProgress(closedItems, closedChecks);
      const closedRecipients = await getRunClosedRecipients(multimediaMinistryId, null);
      if (closedRecipients.length > 0) {
        const dateLabel = formatManilaDate(run.weekStart);
        await createNotificationsForUserIds(closedRecipients, {
          type: "checklist_run_closed",
          title: "Multimedia checklist closed",
          body: `${dateLabel} checklist closed — ${closedProgress.complete}/${closedProgress.total} items complete`,
          link: `/dashboard/multimedia-checklist/history/${run.id}`,
          ministryId: multimediaMinistryId,
        }).catch(() => {});
      }
    }
  }

  // 2. If no run exists for the upcoming Sunday yet, open one.
  const existing = await prisma.checklistRun.findUnique({
    where: { templateId_weekStart: { templateId: template.id, weekStart: upcoming } },
  });
  if (!existing) {
    const created = await prisma.checklistRun.create({
      data: {
        templateId: template.id,
        weekStart: upcoming,
        startedAt: new Date(),
        startedById: null,
      },
    });
    await publishRunChanged("started", created.id);
    started = created.id;
  }

  return NextResponse.json({ closed, started });
}
