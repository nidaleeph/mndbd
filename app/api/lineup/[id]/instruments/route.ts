import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canApproveLineup, canSeeDraftLineup, type PermissionSession } from "@/lib/permissions";
import { getMusicMinistryId } from "@/lib/checklist";
import { createNotification } from "@/services/notificationService";
import { formatManilaDate } from "@/lib/dates";

async function checkLineupEditAccess(
  lineupId: string,
  session: { userId: string; isAdmin: boolean; ministryIds: string[]; headOfMinistryIds: string[] }
) {
  const lineup = await prisma.lineup.findUnique({ where: { id: lineupId } });
  if (!lineup) return { error: "Not found" as const, status: 404 as const };
  const musicMinistryId = await getMusicMinistryId();
  if (!musicMinistryId) {
    return { error: "Music ministry not found" as const, status: 500 as const };
  }
  const ps: PermissionSession = {
    isAdmin: session.isAdmin,
    ministryIds: session.ministryIds,
    headOfMinistryIds: session.headOfMinistryIds,
  };
  // Drafts: creator (or Music head/admin). Non-drafts: Music head (or admin).
  const canEdit =
    lineup.status === "Draft"
      ? canSeeDraftLineup(ps, lineup.createdById, session.userId) ||
        canApproveLineup(ps, musicMinistryId)
      : canApproveLineup(ps, musicMinistryId);
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
  const check = await checkLineupEditAccess(lineupId, {
    userId: session.userId,
    isAdmin: session.isAdmin,
    ministryIds: session.ministryIds,
    headOfMinistryIds: session.headOfMinistryIds,
  });
  if ("error" in check) return NextResponse.json({ error: check.error }, { status: check.status });

  const body = await request.json().catch(() => ({}));
  const instrumentId = body.instrumentId as string | undefined;
  const userId = body.userId as string | undefined;
  if (!instrumentId || !userId) {
    return NextResponse.json({ error: "instrumentId and userId required" }, { status: 400 });
  }

  const instrument = await prisma.instrument.findUnique({ where: { id: instrumentId } });
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!instrument || !user) {
    return NextResponse.json({ error: "Invalid instrument or user" }, { status: 400 });
  }

  await prisma.instrumentAssignment.upsert({
    where: {
      lineupId_instrumentId: { lineupId, instrumentId },
    },
    create: { lineupId, instrumentId, userId },
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
      const dateStr = formatManilaDate(lineup.date);
      await createNotification({
        userId,
        type: "lineup_assignment",
        title: "Assigned as musician",
        body: `You are assigned as ${instrument.name} to ${lineup.eventName} on ${dateStr}.`,
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
  const check = await checkLineupEditAccess(lineupId, {
    userId: session.userId,
    isAdmin: session.isAdmin,
    ministryIds: session.ministryIds,
    headOfMinistryIds: session.headOfMinistryIds,
  });
  if ("error" in check) return NextResponse.json({ error: check.error }, { status: check.status });

  const instrumentId = request.nextUrl.searchParams.get("instrumentId");
  if (!instrumentId) {
    return NextResponse.json({ error: "instrumentId required" }, { status: 400 });
  }

  await prisma.instrumentAssignment.deleteMany({
    where: { lineupId, instrumentId },
  });
  return NextResponse.json({ ok: true });
}
