/**
 * Helpers to resolve notification recipients for ARF, PRF, Lineup, and Prayers.
 * Used with createNotificationsForUserIds for real-time Pusher delivery.
 */

import { prisma } from "@/lib/prisma";

const ADMIN_ROLE_SLUG = "admin";
const PARAKLETOS_SLUG = "parakletos";

/**
 * Returns user IDs of all admin users (for ARF/PRF notifications).
 */
export async function getAdminUserIds(): Promise<string[]> {
  const adminRole = await prisma.role.findUnique({
    where: { slug: ADMIN_ROLE_SLUG },
    select: { users: { where: { status: "active" }, select: { id: true } } },
  });
  if (!adminRole) return [];
  return adminRole.users.map((u) => u.id);
}

/**
 * Returns user IDs of all members in the given ministry.
 * Includes users in UserMinistry and users with ministryId set.
 */
export async function getMinistryMemberIds(ministryId: string): Promise<string[]> {
  const [fromUserMinistry, fromPrimaryMinistry] = await Promise.all([
    prisma.userMinistry.findMany({
      where: { ministryId },
      select: { userId: true },
    }),
    prisma.user.findMany({
      where: { ministryId, status: "active" },
      select: { id: true },
    }),
  ]);
  const ids = new Set<string>();
  fromUserMinistry.forEach((um) => ids.add(um.userId));
  fromPrimaryMinistry.forEach((u) => ids.add(u.id));
  return Array.from(ids);
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
