import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageChecklistRuns, type RoleSlug } from "@/lib/permissions";
import { getMultimediaMinistryId, computeUpcomingSundayManila } from "@/lib/checklist";
import { publishRunChanged } from "@/services/checklistEvents";

export const dynamic = "force-dynamic";

export async function POST() {
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
  if (!canManageChecklistRuns(roleSlug, ministryIds, multimediaMinistryId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const template = await prisma.checklistTemplate.findUnique({
    where: { ministryId: multimediaMinistryId },
    select: { id: true },
  });
  if (!template) {
    return NextResponse.json({ error: "No template" }, { status: 404 });
  }

  const existingOpen = await prisma.checklistRun.findFirst({
    where: { templateId: template.id, closedAt: null },
  });
  if (existingOpen) {
    return NextResponse.json({ message: "An open run already exists" }, { status: 409 });
  }

  const weekStart = computeUpcomingSundayManila();

  const existingAny = await prisma.checklistRun.findUnique({
    where: { templateId_weekStart: { templateId: template.id, weekStart } },
  });
  if (existingAny) {
    return NextResponse.json({ message: "A run already exists for this week" }, { status: 409 });
  }

  const run = await prisma.checklistRun.create({
    data: {
      templateId: template.id,
      weekStart,
      startedAt: new Date(),
      startedById: session.userId,
    },
  });

  await publishRunChanged("started", run.id);
  return NextResponse.json(run);
}
