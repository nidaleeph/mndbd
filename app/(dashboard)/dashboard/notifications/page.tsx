import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageContainer, Card } from "@/components/ui";
import { NotificationsTableClient } from "@/features/notifications/NotificationsTableClient";

export default async function NotificationsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return null;
  const notifications = await prisma.notification.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const rows = notifications.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    link: n.link,
    read: n.read,
    createdAt: n.createdAt,
  }));

  return (
    <PageContainer title="Notifications" description="Your recent notifications">
      <Card>
        <NotificationsTableClient notifications={rows} />
      </Card>
    </PageContainer>
  );
}
