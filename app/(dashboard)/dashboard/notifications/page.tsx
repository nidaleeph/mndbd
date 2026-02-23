import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageContainer, Card } from "@/components/ui";
import { NotificationItem } from "@/components/ui";
import { MarkReadButton } from "./MarkReadButton";

export default async function NotificationsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return null;
  const notifications = await prisma.notification.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <PageContainer title="Notifications" description="Your recent notifications">
      <Card>
        <ul className="divide-y divide-gray-200">
          {notifications.length === 0 ? (
            <li className="py-6 text-center text-[var(--color-text-muted)]">
              No notifications yet
            </li>
          ) : (
            notifications.map((n) => (
              <li key={n.id} className="py-3">
                <NotificationItem
                  notification={{
                    id: n.id,
                    type: n.type,
                    title: n.title,
                    body: n.body,
                    link: n.link,
                    read: n.read,
                    createdAt: n.createdAt,
                  }}
                  onMarkRead={undefined}
                />
                {!n.read && <MarkReadButton notificationId={n.id} />}
              </li>
            ))
          )}
        </ul>
      </Card>
    </PageContainer>
  );
}
