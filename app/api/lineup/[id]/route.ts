import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  canApproveLineup,
  canSeeDraftLineup,
  isMinistryMember,
  type PermissionSession,
} from "@/lib/permissions";
import { getMusicMinistryId } from "@/lib/checklist";
import { lineupSchema } from "@/schemas/lineup";
import { getLineupParticipantIds } from "@/lib/notificationRecipients";
import { createNotificationsForUserIds } from "@/services/notificationService";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const lineup = await prisma.lineup.findUnique({
    where: { id },
    include: {
      ministry: true,
      songs: { orderBy: [{ section: "asc" }, { order: "asc" }] },
      instrumentAssignments: {
        include: { instrument: true, user: { select: { id: true, name: true } } },
      },
      singerAssignments: {
        include: { singerRole: true, user: { select: { id: true, name: true } } },
      },
    },
  });
  if (!lineup) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const ps: PermissionSession = {
    isAdmin: session.isAdmin,
    ministryIds: session.ministryIds,
    headOfMinistryIds: session.headOfMinistryIds,
  };
  const musicMinistryId = await getMusicMinistryId();
  if (!musicMinistryId) {
    return NextResponse.json({ error: "Music ministry not found" }, { status: 500 });
  }
  // Non-music lineups are only visible to admin.
  if (lineup.ministryId !== musicMinistryId && !session.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  // Non-draft lineups: any music member (or admin) can see.
  // Draft lineups: only the creator, or admin.
  if (lineup.status === "Draft") {
    if (!canSeeDraftLineup(ps, lineup.createdById, session.userId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else if (!isMinistryMember(ps, musicMinistryId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json({
    ...lineup,
    date: lineup.date.toISOString(),
  });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const existing = await prisma.lineup.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const ps: PermissionSession = {
    isAdmin: session.isAdmin,
    ministryIds: session.ministryIds,
    headOfMinistryIds: session.headOfMinistryIds,
  };
  const musicMinistryId = await getMusicMinistryId();
  if (!musicMinistryId) {
    return NextResponse.json({ error: "Music ministry not found" }, { status: 500 });
  }
  // Drafts: creator or admin. Non-drafts: Music ministry head (or admin).
  const canEditDraft = canSeeDraftLineup(ps, existing.createdById, session.userId);
  const canEditNonDraft = canApproveLineup(ps, musicMinistryId);
  const canEdit = existing.status === "Draft" ? canEditDraft : canEditNonDraft;
  if (!canEdit) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await request.json();
  const parsed = lineupSchema.safeParse({
    ...body,
    date: body.date ? new Date(body.date) : undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.errors[0]?.message ?? "Validation failed" },
      { status: 400 }
    );
  }
  let statusToUse: "Draft" | "Pending Approval" | "Approved" = (parsed.data.status ??
    existing.status) as "Draft" | "Pending Approval" | "Approved";
  if (statusToUse === "Approved" && !canApproveLineup(ps, musicMinistryId)) {
    statusToUse = existing.status as "Draft" | "Pending Approval" | "Approved";
  }
  await prisma.lineup.update({
    where: { id },
    data: {
      eventName: parsed.data.eventName,
      date: parsed.data.date,
      ministryId: parsed.data.ministryId,
      status: statusToUse,
      updatedAt: new Date(),
    },
  });
  await prisma.song.deleteMany({ where: { lineupId: id } });
  const joyfulSongs = (parsed.data.joyfulSongs ?? []).map((s, i) => ({
    lineupId: id,
    section: "Joyful" as const,
    title: s.title,
    youtubeLink: s.youtubeLink || null,
    order: i,
  }));
  const solemnSongs = (parsed.data.solemnSongs ?? []).map((s, i) => ({
    lineupId: id,
    section: "Solemn" as const,
    title: s.title,
    youtubeLink: s.youtubeLink || null,
    order: i,
  }));
  if (joyfulSongs.length > 0 || solemnSongs.length > 0) {
    await prisma.song.createMany({ data: [...joyfulSongs, ...solemnSongs] });
  }

  // Notify lineup participants when approved (exclude actor)
  if (statusToUse === "Approved" && existing.status !== "Approved") {
    const participantIds = await getLineupParticipantIds(id);
    const recipientIds = participantIds.filter((uid) => uid !== session.userId);
    if (recipientIds.length > 0) {
      await createNotificationsForUserIds(recipientIds, {
        type: "lineup_approved",
        title: "Lineup approved",
        body: `${existing.eventName} has been approved`,
        link: `/dashboard/lineup/${id}`,
      }).catch(() => {});
    }
  }

  return NextResponse.json({ ok: true });
}

/** PATCH: Update status only (submit for approval, approve). Respects roles. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ps: PermissionSession = {
    isAdmin: session.isAdmin,
    ministryIds: session.ministryIds,
    headOfMinistryIds: session.headOfMinistryIds,
  };
  const musicMinistryId = await getMusicMinistryId();
  if (!musicMinistryId) {
    return NextResponse.json({ error: "Music ministry not found" }, { status: 500 });
  }
  const { id } = await params;
  const existing = await prisma.lineup.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body = await request.json();
  const newStatus = body.status as string | undefined;
  if (!newStatus || !["Draft", "Pending Approval", "Approved"].includes(newStatus)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  // Draft -> Pending Approval: creator (or admin)
  if (existing.status === "Draft" && newStatus === "Pending Approval") {
    if (!canSeeDraftLineup(ps, existing.createdById, session.userId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }
  // Pending Approval -> Approved: Music ministry head (or admin)
  if (existing.status === "Pending Approval" && newStatus === "Approved") {
    if (!canApproveLineup(ps, musicMinistryId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    await prisma.approvalHistory.create({
      data: {
        requestType: "LINEUP",
        lineupId: id,
        action: "approved",
        performedById: session.userId,
        comment: body.comment ?? null,
      },
    });
  }
  await prisma.lineup.update({
    where: { id },
    data: { status: newStatus, updatedAt: new Date() },
  });

  // Notify lineup participants when approved (exclude approver)
  if (newStatus === "Approved") {
    const participantIds = await getLineupParticipantIds(id);
    const recipientIds = participantIds.filter((uid) => uid !== session.userId);
    if (recipientIds.length > 0) {
      await createNotificationsForUserIds(recipientIds, {
        type: "lineup_approved",
        title: "Lineup approved",
        body: `${existing.eventName} has been approved`,
        link: `/dashboard/lineup/${id}`,
      }).catch(() => {});
    }
  }

  return NextResponse.json({ ok: true });
}

/** DELETE: Remove lineup. Creator can delete their draft; heads can delete any. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ps: PermissionSession = {
    isAdmin: session.isAdmin,
    ministryIds: session.ministryIds,
    headOfMinistryIds: session.headOfMinistryIds,
  };
  const musicMinistryId = await getMusicMinistryId();
  if (!musicMinistryId) {
    return NextResponse.json({ error: "Music ministry not found" }, { status: 500 });
  }
  const { id } = await params;
  const existing = await prisma.lineup.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const canEditDraft =
    canSeeDraftLineup(ps, existing.createdById, session.userId) ||
    canApproveLineup(ps, musicMinistryId);
  const canEditNonDraft = canApproveLineup(ps, musicMinistryId);
  const canEdit = existing.status === "Draft" ? canEditDraft : canEditNonDraft;
  if (!canEdit) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await prisma.lineup.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
