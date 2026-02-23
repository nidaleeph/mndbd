import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPusher, getPusherChannelName } from "@/lib/pusher";
import type { RoleSlug } from "@/lib/permissions";
import { canSeeDraftLineup } from "@/lib/permissions";
import { getLineupParticipantIds } from "@/lib/notificationRecipients";
import { createNotificationsForUserIds } from "@/services/notificationService";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: lineupId } = await params;
  const lineup = await prisma.lineup.findUnique({ where: { id: lineupId } });
  if (!lineup) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const roleSlug = (session as { roleSlug?: RoleSlug }).roleSlug ?? "user";
  const ministryIds = (session as { ministryIds?: string[] }).ministryIds ?? [];
  if (
    lineup.status === "Draft" &&
    !canSeeDraftLineup(roleSlug, lineup.createdById, lineup.ministryId, session.userId, ministryIds)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const messages = await prisma.chatMessage.findMany({
    where: { lineupId },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { name: true } } },
  });
  return NextResponse.json(
    messages.map((m) => ({
      id: m.id,
      body: m.body,
      userId: m.userId,
      userName: m.user.name,
      createdAt: m.createdAt.toISOString(),
    }))
  );
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: lineupId } = await params;
  const lineup = await prisma.lineup.findUnique({ where: { id: lineupId } });
  if (!lineup) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const roleSlug = (session as { roleSlug?: RoleSlug }).roleSlug ?? "user";
  const ministryIds = (session as { ministryIds?: string[] }).ministryIds ?? [];
  if (
    lineup.status === "Draft" &&
    !canSeeDraftLineup(roleSlug, lineup.createdById, lineup.ministryId, session.userId, ministryIds)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  const text = (body.body as string)?.trim();
  if (!text) {
    return NextResponse.json({ error: "Body required" }, { status: 400 });
  }
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { name: true },
  });
  const msg = await prisma.chatMessage.create({
    data: { lineupId, userId: session.userId, body: text },
  });
  const payload = {
    id: msg.id,
    body: msg.body,
    userId: msg.userId,
    userName: user?.name ?? "User",
    createdAt: msg.createdAt.toISOString(),
  };
  const pusher = getPusher();
  if (pusher) {
    await pusher
      .trigger(getPusherChannelName("chat", lineupId), "message", payload)
      .catch(() => {});
  }

  // Notify lineup participants of new chat message (exclude sender)
  const participantIds = await getLineupParticipantIds(lineupId);
  const recipientIds = participantIds.filter((uid) => uid !== session.userId);
  if (recipientIds.length > 0) {
    await createNotificationsForUserIds(recipientIds, {
      type: "lineup_chat",
      title: "New message in lineup",
      body: `${user?.name ?? "Someone"} sent a message in ${lineup.eventName}`,
      link: `/dashboard/lineup/${lineupId}`,
    }).catch(() => {});
  }

  return NextResponse.json(payload);
}
