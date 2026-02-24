import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { RoleSlug } from "@/lib/permissions";
import { canManageMinistry, canSeeDraftLineup } from "@/lib/permissions";
import { createNotification } from "@/services/notificationService";

async function checkLineupEditAccess(
  lineupId: string,
  session: { userId: string; roleSlug?: RoleSlug; ministryIds?: string[] }
) {
  const lineup = await prisma.lineup.findUnique({ where: { id: lineupId } });
  if (!lineup) return { error: "Not found" as const, status: 404 as const };
  const roleSlug = (session.roleSlug ?? "user") as RoleSlug;
  const ministryIds = session.ministryIds ?? [];
  const canEdit =
    canSeeDraftLineup(roleSlug, lineup.createdById, lineup.ministryId, session.userId, ministryIds) ||
    canManageMinistry(roleSlug, ministryIds, lineup.ministryId);
  if (!canEdit) {
    return { error: "Forbidden" as const, status: 403 as const };
  }
  return { lineup };
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: lineupId } = await params;
  const check = await checkLineupEditAccess(
    lineupId,
    session as { userId: string; roleSlug?: RoleSlug; ministryIds?: string[] }
  );
  if ("error" in check) return NextResponse.json({ error: check.error }, { status: check.status });

  const body = await request.json().catch(() => ({}));
  const singerRoleId = body.singerRoleId as string | undefined;
  const userId = body.userId as string | undefined;
  if (!singerRoleId || !userId) {
    return NextResponse.json({ error: "singerRoleId and userId required" }, { status: 400 });
  }

  const singerRole = await prisma.singerRole.findUnique({ where: { id: singerRoleId } });
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!singerRole || !user) {
    return NextResponse.json({ error: "Invalid singer role or user" }, { status: 400 });
  }

  await prisma.singerAssignment.upsert({
    where: {
      lineupId_singerRoleId: { lineupId, singerRoleId },
    },
    create: { lineupId, singerRoleId, userId },
    update: { userId },
  });

  // Notify assigned user when someone else assigns them (skip self-assignment)
  const assignerId = (session as { userId?: string }).userId ?? "";
  if (userId !== assignerId) {
    const lineup = await prisma.lineup.findUnique({
      where: { id: lineupId },
      select: { eventName: true, date: true, ministryId: true },
    });
    if (lineup) {
      const dateStr = new Date(lineup.date).toLocaleDateString();
      await createNotification({
        userId,
        type: "lineup_assignment",
        title: "Assigned as singer",
        body: `You are assigned as ${singerRole.name} to ${lineup.eventName} on ${dateStr}.`,
        link: `/dashboard/lineup/${lineupId}`,
        ministryId: lineup.ministryId ?? undefined,
      }).catch(() => {});
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: lineupId } = await params;
  const check = await checkLineupEditAccess(
    lineupId,
    session as { userId: string; roleSlug?: RoleSlug; ministryIds?: string[] }
  );
  if ("error" in check) return NextResponse.json({ error: check.error }, { status: check.status });

  const singerRoleId = request.nextUrl.searchParams.get("singerRoleId");
  if (!singerRoleId) {
    return NextResponse.json({ error: "singerRoleId required" }, { status: 400 });
  }

  await prisma.singerAssignment.deleteMany({
    where: { lineupId, singerRoleId },
  });
  return NextResponse.json({ ok: true });
}
