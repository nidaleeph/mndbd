import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { RoleSlug } from "@/lib/permissions";
import { DashboardShell } from "@/components/layout/DashboardShell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    redirect("/login?callbackUrl=/dashboard");
  }
  const roleSlug = (session as { roleSlug?: RoleSlug }).roleSlug ?? "user";

  const unreadCount = await prisma.notification.count({
    where: { userId: session.userId, read: false },
  });
  const recentNotifications = await prisma.notification.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  const notificationList = recentNotifications.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    link: n.link,
    read: n.read,
    createdAt: n.createdAt,
  }));

  const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY ?? "";
  const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER ?? "";

  return (
    <DashboardShell
      user={{
        name: session.user?.name ?? null,
        email: session.user?.email ?? null,
      }}
      userId={session.userId}
      roleSlug={roleSlug}
      notifications={notificationList}
      unreadCount={unreadCount}
      pusherKey={pusherKey}
      pusherCluster={pusherCluster}
    >
      {children}
    </DashboardShell>
  );
}
