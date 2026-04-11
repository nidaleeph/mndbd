/**
 * Helpers to resolve notification recipients for ARF, PRF, Lineup, and Prayers.
 * Used with createNotificationsForUserIds for real-time Pusher delivery.
 */

import { prisma } from "@/lib/prisma";

const PARAKLETOS_SLUG = "parakletos";

/**
 * Returns user IDs of all admin users (for ARF/PRF notifications).
 */
export async function getAdminUserIds(): Promise<string[]> {
  const admins = await prisma.user.findMany({
    where: { isAdmin: true, status: "active" },
    select: { id: true },
  });
  return admins.map((u) => u.id);
}

/**
 * Returns user IDs of all active members in the given ministry.
 */
export async function getMinistryMemberIds(ministryId: string): Promise<string[]> {
  const rows = await prisma.userMinistry.findMany({
    where: {
      ministryId,
      user: { status: "active" },
    },
    select: { userId: true },
  });
  return rows.map((r) => r.userId);
}

/** Returns active users who are heads of the given ministry. */
export async function getMinistryHeadIds(ministryId: string): Promise<string[]> {
  const rows = await prisma.userMinistry.findMany({
    where: {
      ministryId,
      role: "head",
      user: { status: "active" },
    },
    select: { userId: true },
  });
  return rows.map((r) => r.userId);
}

/**
 * Returns user IDs of all Parakletos ministry members (for prayer notifications).
 */
export async function getParakletosMemberIds(): Promise<string[]> {
  const parakletos = await prisma.ministry.findUnique({
    where: { slug: PARAKLETOS_SLUG },
  });
  if (!parakletos) return [];
  return getMinistryMemberIds(parakletos.id);
}

/**
 * Returns creator + instrument assignees + singer assignees for a lineup.
 * Used for lineup approval and chat notifications.
 */
export async function getLineupParticipantIds(lineupId: string): Promise<string[]> {
  const lineup = await prisma.lineup.findUnique({
    where: { id: lineupId },
    include: {
      instrumentAssignments: { select: { userId: true } },
      singerAssignments: { select: { userId: true } },
    },
  });
  if (!lineup) return [];
  const ids = new Set<string>();
  ids.add(lineup.createdById);
  lineup.instrumentAssignments.forEach((a) => ids.add(a.userId));
  lineup.singerAssignments.forEach((a) => ids.add(a.userId));
  return Array.from(ids);
}
