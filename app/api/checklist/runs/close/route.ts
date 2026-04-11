import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageChecklistRuns, type PermissionSession } from "@/lib/permissions";
import {
  computeRunProgress,
  getMultimediaMinistryId,
  getRunClosedRecipients,
} from "@/lib/checklist";
import { createNotificationsForUserIds } from "@/services/notificationService";
import { publishRunChanged } from "@/services/checklistEvents";
import { formatManilaDate } from "@/lib/dates";

export const dynamic = "force-dynamic";

export async function POST() {
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
  if (!canManageChecklistRuns(ps, multimediaMinistryId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const template = await prisma.checklistTemplate.findUnique({
    where: { ministryId: multimediaMinistryId },
    select: { id: true },
  });
  if (!template) {
    return NextResponse.json({ error: "No template" }, { status: 404 });
  }

  const openRun = await prisma.checklistRun.findFirst({
    where: { templateId: template.id, closedAt: null },
  });
  if (!openRun) {
    return NextResponse.json({ message: "No open run" }, { status: 404 });
  }

  const closed = await prisma.checklistRun.update({
    where: { id: openRun.id },
    data: { closedAt: new Date(), closedById: session.userId },
  });

  await publishRunChanged("closed", closed.id);

  // Notify admins + Multimedia heads (excluding the actor) with a summary.
  const closedTemplate = await prisma.checklistTemplate.findUnique({
    where: { id: closed.templateId },
    include: {
      categories: { include: { items: { select: { id: true, archivedAt: true } } } },
    },
  });
  const closedChecks = await prisma.itemCheck.findMany({
    where: { runId: closed.id },
    select: { itemId: true },
  });
  const closedItems = closedTemplate?.categories.flatMap((c) => c.items) ?? [];
  const closedProgress = computeRunProgress(closedItems, closedChecks);

  const closedRecipients = await getRunClosedRecipients(multimediaMinistryId, session.userId);
  if (closedRecipients.length > 0) {
    const dateLabel = formatManilaDate(closed.weekStart);
    await createNotificationsForUserIds(closedRecipients, {
      type: "checklist_run_closed",
      title: "Multimedia checklist closed",
      body: `${dateLabel} checklist closed — ${closedProgress.complete}/${closedProgress.total} items complete`,
      link: `/dashboard/multimedia-checklist/history/${closed.id}`,
      ministryId: multimediaMinistryId,
    }).catch(() => {});
  }

  return NextResponse.json(closed);
}
