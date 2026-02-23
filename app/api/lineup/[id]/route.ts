import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { RoleSlug } from "@/lib/permissions";
import { canManageMinistry, canSeeDraftLineup } from "@/lib/permissions";
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
  const roleSlug = (session as { roleSlug?: RoleSlug }).roleSlug ?? "user";
  const ministryIds = (session as { ministryIds?: string[] }).ministryIds ?? [];
  const musicMinistry = await prisma.ministry.findUnique({ where: { slug: "music" } });
  if (musicMinistry && lineup.ministryId !== musicMinistry.id && roleSlug !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (
    lineup.status === "Draft" &&
    !canSeeDraftLineup(roleSlug, lineup.createdById, lineup.ministryId, session.userId, ministryIds)
  ) {
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
  const roleSlug = (session as { roleSlug?: RoleSlug }).roleSlug ?? "user";
  const ministryIds = (session as { ministryIds?: string[] }).ministryIds ?? [];
  const canEditDraft = canSeeDraftLineup(
    roleSlug,
    existing.createdById,
    existing.ministryId,
    session.userId,
    ministryIds
  );
  const canEditNonDraft = canManageMinistry(roleSlug, ministryIds, existing.ministryId);
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
  if (
    statusToUse === "Approved" &&
    !canManageMinistry(roleSlug, ministryIds, existing.ministryId)
  ) {
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
  const roleSlug = (session as { roleSlug?: RoleSlug }).roleSlug ?? "user";
  const ministryIds = (session as { ministryIds?: string[] }).ministryIds ?? [];
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
  // Draft -> Pending Approval: creator or ministry head
  if (existing.status === "Draft" && newStatus === "Pending Approval") {
    if (
      !canSeeDraftLineup(
        roleSlug,
        existing.createdById,
        existing.ministryId,
        session.userId,
        ministryIds
      )
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }
  // Pending Approval -> Approved: admin or ministry head of that ministry
  if (existing.status === "Pending Approval" && newStatus === "Approved") {
    if (!canManageMinistry(roleSlug, ministryIds, existing.ministryId)) {
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

/** DELETE: Remove lineup. Respects canSeeDraftLineup (edit permission). */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const roleSlug = (session as { roleSlug?: RoleSlug }).roleSlug ?? "user";
  const ministryIds = (session as { ministryIds?: string[] }).ministryIds ?? [];
  const { id } = await params;
  const existing = await prisma.lineup.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const canEditDraft = canSeeDraftLineup(
    roleSlug,
    existing.createdById,
    existing.ministryId,
    session.userId,
    ministryIds
  );
  const canEditNonDraft = canManageMinistry(roleSlug, ministryIds, existing.ministryId);
  const canEdit = existing.status === "Draft" ? canEditDraft : canEditNonDraft;
  if (!canEdit) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await prisma.lineup.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
