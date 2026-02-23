/**
 * Create in-app notifications and optionally trigger Pusher for real-time delivery.
 * Pusher payload includes id and createdAt for client mark-read and deduplication.
 */

import { prisma } from "@/lib/prisma";
import { getPusher, getPusherChannelName } from "@/lib/pusher";

export interface NotificationParams {
  userId: string;
  type: string;
  title: string;
  body: string;
  link?: string;
  ministryId?: string;
}

export async function createNotification(params: NotificationParams): Promise<void> {
  const notification = await prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      body: params.body,
      link: params.link,
      ministryId: params.ministryId,
    },
  });
  const pusher = getPusher();
  if (pusher) {
    const channel = getPusherChannelName("notifications", params.userId);
    const payload = {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      link: notification.link,
      ministryId: notification.ministryId,
      createdAt: notification.createdAt.toISOString(),
    };
    await pusher.trigger(channel, "notification", payload).catch(() => {});
  }
}

export async function createNotificationsForUserIds(
  userIds: string[],
  params: { type: string; title: string; body: string; link?: string; ministryId?: string }
): Promise<void> {
  if (userIds.length === 0) return;
  const pusher = getPusher();
  const notifications = await Promise.all(
    userIds.map((userId) =>
      prisma.notification.create({
        data: {
          userId,
          type: params.type,
          title: params.title,
          body: params.body,
          link: params.link,
          ministryId: params.ministryId,
        },
      })
    )
  );
  if (pusher) {
    await Promise.all(
      notifications.map((n) => {
        const payload = {
          id: n.id,
          type: n.type,
          title: n.title,
          body: n.body,
          link: n.link,
          ministryId: n.ministryId,
          createdAt: n.createdAt.toISOString(),
        };
        return pusher
          .trigger(getPusherChannelName("notifications", n.userId), "notification", payload)
          .catch(() => {});
      })
    );
  }
}
