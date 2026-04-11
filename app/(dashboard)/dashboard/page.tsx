import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageContainer, Card, Section } from "@/components/ui";
import { FiFileText, FiMusic, FiPlus, FiUsers, FiSettings } from "react-icons/fi";
import Link from "next/link";

function QuickActionLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-[var(--radius)] bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-primary-hover)] focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 focus:outline-none"
    >
      <span className="shrink-0 [&>svg]:size-4">{icon}</span>
      {children}
    </Link>
  );
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const isAdmin = session?.isAdmin ?? false;
  const userId = session?.userId ?? "";
  const headOfMinistryIds = session?.headOfMinistryIds ?? [];
  const isMinistryHead = !isAdmin && headOfMinistryIds.length > 0;
  const isPlainMember = !isAdmin && headOfMinistryIds.length === 0;

  // Data based on role
  const pendingLineupsCount = isAdmin
    ? await prisma.lineup.count({ where: { status: "Pending Approval" } })
    : isMinistryHead
      ? await prisma.lineup.count({
          where: { ministryId: { in: headOfMinistryIds }, status: "Pending Approval" },
        })
      : 0;
  const recentArfs = isAdmin
    ? await prisma.aRF.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        include: { ministry: true },
      })
    : isMinistryHead
      ? await prisma.aRF.findMany({
          where: { ministryId: { in: headOfMinistryIds } },
          take: 5,
          orderBy: { createdAt: "desc" },
          include: { ministry: true },
        })
      : [];
  const upcomingLineups = isAdmin
    ? await prisma.lineup.findMany({
        where: { date: { gte: new Date() } },
        take: 5,
        orderBy: { date: "asc" },
        include: { ministry: true },
      })
    : isMinistryHead
      ? await prisma.lineup.findMany({
          where: { ministryId: { in: headOfMinistryIds }, date: { gte: new Date() } },
          take: 5,
          orderBy: { date: "asc" },
          include: { ministry: true },
        })
      : await prisma.lineup.findMany({
          where: {
            status: "Approved",
            date: { gte: new Date() },
          },
          take: 5,
          orderBy: { date: "asc" },
          include: { ministry: true },
        });
  const myAssignments = isPlainMember
    ? await prisma.instrumentAssignment.findMany({
        where: { userId },
        include: { lineup: true, instrument: true },
      })
    : [];
  const mySingerAssignments = isPlainMember
    ? await prisma.singerAssignment.findMany({
        where: { userId },
        include: { lineup: true, singerRole: true },
      })
    : [];

  // Admin-only: system stats and recent notifications
  const systemStats = isAdmin
    ? {
        ministries: await prisma.ministry.count({ where: { active: true } }),
        users: await prisma.user.count(),
        pendingLineups: pendingLineupsCount,
      }
    : null;
  const recentNotifications = isAdmin
    ? await prisma.notification.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
      })
    : [];
  // Plain members: announcements widget
  const userAnnouncements = isPlainMember
    ? await prisma.notification.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
      })
    : [];

  // Ministry head: draft lineups for the ministries they head
  const draftLineups = isMinistryHead
    ? await prisma.lineup.findMany({
        where: { ministryId: { in: headOfMinistryIds }, status: "Draft" },
        take: 10,
        orderBy: { updatedAt: "desc" },
        include: { ministry: true },
      })
    : [];

  return (
    <PageContainer title="Dashboard" description="Overview of your ministry activity">
      {/* Admin: Quick Actions and widgets */}
      {isAdmin && (
        <>
          <Section title="Quick Actions">
            <div className="flex flex-wrap gap-3">
              <QuickActionLink href="/dashboard/lineup/new" icon={<FiPlus />}>
                Create Event
              </QuickActionLink>
              <QuickActionLink href="/dashboard/settings" icon={<FiSettings />}>
                Manage Ministries
              </QuickActionLink>
              <QuickActionLink href="/dashboard/lineup" icon={<FiFileText />}>
                Approve Lineups
              </QuickActionLink>
              <QuickActionLink href="/dashboard/users" icon={<FiUsers />}>
                Add User
              </QuickActionLink>
            </div>
          </Section>
          <Section title="Upcoming Events">
            <Card>
              <ul className="space-y-2">
                {upcomingLineups.length === 0 ? (
                  <li className="text-[var(--color-text-muted)]">No upcoming events</li>
                ) : (
                  upcomingLineups.map((l) => (
                    <li key={l.id}>
                      <Link
                        href={`/dashboard/lineup/${l.id}`}
                        className="text-[var(--color-primary)] hover:underline"
                      >
                        {l.eventName}
                      </Link>
                      <span className="ml-2 text-sm text-[var(--color-text-muted)]">
                        {new Date(l.date).toLocaleDateString()} · {l.ministry.name}
                      </span>
                    </li>
                  ))
                )}
              </ul>
              <Link
                href="/dashboard/calendar"
                className="mt-2 inline-block text-sm text-[var(--color-primary)] hover:underline"
              >
                View calendar
              </Link>
            </Card>
          </Section>
          <Section title="Pending Approvals">
            <Card>
              <p className="text-[var(--color-text-muted)]">
                Lineups pending: <strong>{pendingLineupsCount}</strong>
              </p>
              <Link
                href="/dashboard/lineup"
                className="mt-2 text-sm text-[var(--color-primary)] hover:underline"
              >
                View lineups
              </Link>
            </Card>
          </Section>
          <Section title="Recent Requests">
            <Card>
              <ul className="space-y-2">
                {recentArfs.length === 0 ? (
                  <li className="text-[var(--color-text-muted)]">No recent ARFs</li>
                ) : (
                  recentArfs.map((arf) => (
                    <li key={arf.id}>
                      <Link
                        href={`/dashboard/forms/arf/${arf.id}`}
                        className="text-[var(--color-primary)] hover:underline"
                      >
                        {arf.eventName}
                      </Link>
                      <span className="ml-2 text-sm text-[var(--color-text-muted)]">
                        {arf.ministry.name} · {arf.status}
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </Card>
          </Section>
          {systemStats && (
            <Section title="System Stats">
              <Card>
                <ul className="space-y-1 text-[var(--color-text-muted)]">
                  <li>
                    Ministries:{" "}
                    <strong className="text-[var(--color-text)]">{systemStats.ministries}</strong>
                  </li>
                  <li>
                    Users: <strong className="text-[var(--color-text)]">{systemStats.users}</strong>
                  </li>
                  <li>
                    Pending lineups:{" "}
                    <strong className="text-[var(--color-text)]">
                      {systemStats.pendingLineups}
                    </strong>
                  </li>
                </ul>
              </Card>
            </Section>
          )}
          <Section title="Recent Notifications">
            <Card>
              <ul className="space-y-2">
                {recentNotifications.length === 0 ? (
                  <li className="text-[var(--color-text-muted)]">No recent notifications</li>
                ) : (
                  recentNotifications.map((n) => (
                    <li key={n.id}>
                      <span className="font-medium">{n.title}</span>
                      <span className="ml-2 text-sm text-[var(--color-text-muted)]">
                        {new Date(n.createdAt).toLocaleDateString()}
                      </span>
                      {n.body && (
                        <p className="mt-1 line-clamp-2 text-sm text-[var(--color-text-muted)]">
                          {n.body}
                        </p>
                      )}
                    </li>
                  ))
                )}
              </ul>
              <Link
                href="/dashboard/notifications"
                className="mt-2 inline-block text-sm text-[var(--color-primary)] hover:underline"
              >
                See all notifications
              </Link>
            </Card>
          </Section>
          <Section title="Calendar Overview">
            <Card>
              <p className="mb-2 text-[var(--color-text-muted)]">
                View and manage the ministry calendar.
              </p>
              <Link
                href="/dashboard/calendar"
                className="text-[var(--color-primary)] hover:underline"
              >
                Open calendar
              </Link>
            </Card>
          </Section>
        </>
      )}

      {/* Ministry Head: Quick Actions and widgets */}
      {isMinistryHead && (
        <>
          <Section title="Quick Actions">
            <div className="flex flex-wrap gap-3">
              <QuickActionLink href="/dashboard/lineup/new" icon={<FiPlus />}>
                Create Lineup
              </QuickActionLink>
              <QuickActionLink
                href={
                  draftLineups[0] ? `/dashboard/lineup/${draftLineups[0].id}` : "/dashboard/lineup"
                }
                icon={<FiFileText />}
              >
                Edit Draft
              </QuickActionLink>
              <QuickActionLink href="/dashboard/lineup" icon={<FiFileText />}>
                Submit for Approval
              </QuickActionLink>
            </div>
          </Section>
          <Section title="My Ministry Events">
            <Card>
              <ul className="space-y-2">
                {recentArfs.length === 0 ? (
                  <li className="text-[var(--color-text-muted)]">No recent ARFs</li>
                ) : (
                  recentArfs.map((arf) => (
                    <li key={arf.id}>
                      <Link
                        href={`/dashboard/forms/arf/${arf.id}`}
                        className="text-[var(--color-primary)] hover:underline"
                      >
                        {arf.eventName}
                      </Link>
                      <span className="ml-2 text-sm text-[var(--color-text-muted)]">
                        {arf.status}
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </Card>
          </Section>
          <Section title="Pending Lineups">
            <Card>
              <p className="text-[var(--color-text-muted)]">
                Lineups pending approval: <strong>{pendingLineupsCount}</strong>
              </p>
              <Link
                href="/dashboard/lineup"
                className="mt-2 text-sm text-[var(--color-primary)] hover:underline"
              >
                View lineups
              </Link>
            </Card>
          </Section>
          <Section title="Draft Lineups">
            <Card>
              <ul className="space-y-2">
                {draftLineups.length === 0 ? (
                  <li className="text-[var(--color-text-muted)]">No draft lineups</li>
                ) : (
                  draftLineups.map((l) => (
                    <li key={l.id}>
                      <Link
                        href={`/dashboard/lineup/${l.id}`}
                        className="text-[var(--color-primary)] hover:underline"
                      >
                        {l.eventName}
                      </Link>
                      <span className="ml-2 text-sm text-[var(--color-text-muted)]">
                        {new Date(l.date).toLocaleDateString()}
                      </span>
                    </li>
                  ))
                )}
              </ul>
              <Link
                href="/dashboard/lineup"
                className="mt-2 inline-block text-sm text-[var(--color-primary)] hover:underline"
              >
                View all lineups
              </Link>
            </Card>
          </Section>
          <Section title="Volunteers List">
            <Card>
              <p className="mb-2 text-[var(--color-text-muted)]">
                View volunteers in your ministry.
              </p>
              <Link href="/dashboard/users" className="text-[var(--color-primary)] hover:underline">
                View volunteers
              </Link>
            </Card>
          </Section>
          <Section title="Upcoming Schedule">
            <Card>
              <ul className="space-y-2">
                {upcomingLineups.length === 0 ? (
                  <li className="text-[var(--color-text-muted)]">No upcoming lineups</li>
                ) : (
                  upcomingLineups.map((l) => (
                    <li key={l.id}>
                      <Link
                        href={`/dashboard/lineup/${l.id}`}
                        className="text-[var(--color-primary)] hover:underline"
                      >
                        {l.eventName}
                      </Link>
                      <span className="ml-2 text-sm text-[var(--color-text-muted)]">
                        {new Date(l.date).toLocaleDateString()} · {l.status}
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </Card>
          </Section>
        </>
      )}

      {/* Plain member: My Schedule, Upcoming Events, Announcements */}
      {isPlainMember && (
        <>
          <Section title="My Schedule">
            <Card>
              <ul className="space-y-2">
                {myAssignments.length === 0 && mySingerAssignments.length === 0 ? (
                  <li className="text-[var(--color-text-muted)]">No assignments yet</li>
                ) : (
                  <>
                    {myAssignments.map((a) => (
                      <li key={`inst-${a.lineupId}-${a.instrumentId}`}>
                        <FiMusic className="mr-2 inline size-4" />
                        {a.instrument.name} – {a.lineup.eventName}{" "}
                        {new Date(a.lineup.date).toLocaleDateString()}
                      </li>
                    ))}
                    {mySingerAssignments.map((a) => (
                      <li key={`singer-${a.lineupId}-${a.singerRoleId}`}>
                        <FiMusic className="mr-2 inline size-4" />
                        {a.singerRole.name} – {a.lineup.eventName}{" "}
                        {new Date(a.lineup.date).toLocaleDateString()}
                      </li>
                    ))}
                  </>
                )}
              </ul>
              <Link
                href="/dashboard/calendar"
                className="mt-2 inline-block text-sm text-[var(--color-primary)] hover:underline"
              >
                View my schedule
              </Link>
            </Card>
          </Section>
          <Section title="Upcoming Events">
            <Card>
              <ul className="space-y-2">
                {upcomingLineups.length === 0 ? (
                  <li className="text-[var(--color-text-muted)]">No upcoming events</li>
                ) : (
                  upcomingLineups.map((l) => (
                    <li key={l.id}>
                      <Link
                        href={`/dashboard/lineup/${l.id}`}
                        className="text-[var(--color-primary)] hover:underline"
                      >
                        {l.eventName}
                      </Link>
                      <span className="ml-2 text-sm text-[var(--color-text-muted)]">
                        {new Date(l.date).toLocaleDateString()} · {l.ministry.name}
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </Card>
          </Section>
          <Section title="Announcements">
            <Card>
              <ul className="space-y-2">
                {userAnnouncements.length === 0 ? (
                  <li className="text-[var(--color-text-muted)]">No announcements</li>
                ) : (
                  userAnnouncements.map((n) => (
                    <li key={n.id}>
                      <span className="font-medium">{n.title}</span>
                      <span className="ml-2 text-sm text-[var(--color-text-muted)]">
                        {new Date(n.createdAt).toLocaleDateString()}
                      </span>
                      {n.body && (
                        <p className="mt-1 line-clamp-2 text-sm text-[var(--color-text-muted)]">
                          {n.body}
                        </p>
                      )}
                    </li>
                  ))
                )}
              </ul>
              <Link
                href="/dashboard/notifications"
                className="mt-2 inline-block text-sm text-[var(--color-primary)] hover:underline"
              >
                See all notifications
              </Link>
            </Card>
          </Section>
        </>
      )}
    </PageContainer>
  );
}
