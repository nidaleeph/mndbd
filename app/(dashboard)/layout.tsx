import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMultimediaMinistryId } from "@/lib/checklist";
import {
  canAccessForms,
  canAccessReports,
  canAccessSettings,
  canAccessUsers,
  isMinistryMember,
  type PermissionSession,
} from "@/lib/permissions";
import { DashboardShell } from "@/components/layout/DashboardShell";
import type { SidebarGates } from "@/components/layout/Sidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    redirect("/login?callbackUrl=/dashboard");
  }
  if (session.status === "pending") {
    redirect("/pending");
  }
  if (session.status === "inactive") {
    redirect("/login?error=inactive");
  }

  const permissionSession: PermissionSession = {
    isAdmin: session.isAdmin,
    ministryIds: session.ministryIds,
    headOfMinistryIds: session.headOfMinistryIds,
  };

  const multimediaMinistryId = await getMultimediaMinistryId();

  const gates: SidebarGates = {
    canAccessUsers: canAccessUsers(permissionSession),
    canAccessForms: canAccessForms(permissionSession),
    canAccessSettings: canAccessSettings(permissionSession),
    canAccessReports: canAccessReports(permissionSession),
    isMultimediaMember: multimediaMinistryId
      ? isMinistryMember(permissionSession, multimediaMinistryId)
      : false,
  };

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
      gates={gates}
      isAdmin={session.isAdmin}
      notifications={notificationList}
      unreadCount={unreadCount}
      pusherKey={pusherKey}
      pusherCluster={pusherCluster}
    >
      {children}
    </DashboardShell>
  );
}
