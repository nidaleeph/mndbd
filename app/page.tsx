import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui";

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  const isLoggedIn = Boolean(session?.user);

  const [upcomingLineups, ministries, announcements] = await Promise.all([
    prisma.lineup.findMany({
      where: { status: "Approved", date: { gte: new Date() } },
      orderBy: { date: "asc" },
      take: 6,
      include: { ministry: true },
    }),
    prisma.ministry.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
    prisma.notification.findMany({
      orderBy: { createdAt: "desc" },
      take: 4,
    }),
  ]);

  const viewEventsHref = isLoggedIn
    ? "/dashboard/calendar"
    : "/login?callbackUrl=/dashboard/calendar";
  const joinMinistryHref = isLoggedIn ? "/dashboard" : "/signup";

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header / Nav */}
      <header className="border-b border-gray-200 bg-[var(--color-card-bg)] shadow-[var(--shadow-soft)]">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link
            href="/"
            className="text-xl font-semibold text-[var(--color-text-dark)] hover:opacity-90"
          >
            Church Ministry
          </Link>
          <nav className="flex items-center gap-4">
            <Link
              href="/#events"
              className="text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
            >
              Events
            </Link>
            <Link
              href="/#ministries"
              className="text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
            >
              Ministries
            </Link>
            {isLoggedIn ? (
              <Link
                href="/dashboard"
                className="rounded-[var(--radius)] bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-primary-hover)]"
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm font-medium text-[var(--color-text-dark)] hover:text-[var(--color-primary)]"
                >
                  Login
                </Link>
                <Link
                  href="/signup"
                  className="rounded-[var(--radius)] bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-primary-hover)]"
                >
                  Sign up
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-[var(--color-soft-blue-bg)] py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-[var(--color-text-dark)] md:text-5xl">
            Church Ministry Management
          </h1>
          <p className="mt-4 text-lg text-[var(--color-text-muted)] md:text-xl">
            Organize events, lineups, and volunteers in one place. Built for church leaders and
            ministry teams.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href={viewEventsHref}
              className="inline-flex items-center justify-center rounded-[var(--radius)] bg-[var(--color-primary)] px-6 py-3 text-base font-medium text-white hover:bg-[var(--color-primary-hover)] focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 focus:outline-none"
            >
              View Events
            </Link>
            <Link
              href={joinMinistryHref}
              className="inline-flex items-center justify-center rounded-[var(--radius)] border-2 border-[var(--color-gold-accent)] bg-transparent px-6 py-3 text-base font-medium text-[var(--color-text-dark)] hover:bg-[var(--color-gold-accent)]/10 focus:ring-2 focus:ring-[var(--color-gold-accent)] focus:ring-offset-2 focus:outline-none"
            >
              Join Ministry
            </Link>
          </div>
        </div>
      </section>

      {/* Upcoming Events */}
      <section id="events" className="py-12 md:py-16">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-2xl font-bold text-[var(--color-text-dark)]">Upcoming Events</h2>
          <p className="mt-1 text-[var(--color-text-muted)]">Sunday lineups and ministry events</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {upcomingLineups.length === 0 ? (
              <Card className="sm:col-span-2 lg:col-span-3">
                <p className="text-[var(--color-text-muted)]">
                  No upcoming events yet. Check back soon.
                </p>
              </Card>
            ) : (
              upcomingLineups.map((lineup) => (
                <Link
                  key={lineup.id}
                  href={isLoggedIn ? `/dashboard/lineup/${lineup.id}` : viewEventsHref}
                >
                  <Card className="h-full transition hover:shadow-lg">
                    <p className="font-semibold text-[var(--color-text-dark)]">
                      {lineup.eventName}
                    </p>
                    <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                      {new Date(lineup.date).toLocaleDateString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                    <p className="mt-1 text-sm text-[var(--color-primary)]">
                      {lineup.ministry.name}
                    </p>
                  </Card>
                </Link>
              ))
            )}
          </div>
          <div className="mt-6 text-center">
            <Link
              href={viewEventsHref}
              className="text-sm font-medium text-[var(--color-primary)] hover:underline"
            >
              View all events
            </Link>
          </div>
        </div>
      </section>

      {/* Church Announcements */}
      <section className="bg-[var(--color-soft-blue-bg)] py-12 md:py-16">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-2xl font-bold text-[var(--color-text-dark)]">Church Announcements</h2>
          <p className="mt-1 text-[var(--color-text-muted)]">Latest updates and news</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {announcements.length === 0 ? (
              <Card className="sm:col-span-2">
                <p className="text-[var(--color-text-muted)]">No announcements yet.</p>
              </Card>
            ) : (
              announcements.map((n) => (
                <Card key={n.id}>
                  <p className="font-semibold text-[var(--color-text-dark)]">{n.title}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-[var(--color-text-muted)]">
                    {n.body}
                  </p>
                  <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                    {new Date(n.createdAt).toLocaleDateString()}
                  </p>
                </Card>
              ))
            )}
          </div>
          <div className="mt-6 text-center">
            <Link
              href={
                isLoggedIn
                  ? "/dashboard/notifications"
                  : "/login?callbackUrl=/dashboard/notifications"
              }
              className="text-sm font-medium text-[var(--color-primary)] hover:underline"
            >
              See all notifications
            </Link>
          </div>
        </div>
      </section>

      {/* Ministry Highlights */}
      <section id="ministries" className="py-12 md:py-16">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-2xl font-bold text-[var(--color-text-dark)]">Ministry Highlights</h2>
          <p className="mt-1 text-[var(--color-text-muted)]">Get involved in our ministries</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ministries.map((m) => (
              <Card key={m.id} className="flex flex-col">
                <p className="font-semibold text-[var(--color-text-dark)]">{m.name}</p>
                {m.description ? (
                  <p className="mt-1 flex-1 text-sm text-[var(--color-text-muted)]">
                    {m.description}
                  </p>
                ) : null}
                <Link
                  href={joinMinistryHref}
                  className="mt-3 text-sm font-medium text-[var(--color-primary)] hover:underline"
                >
                  Learn more
                </Link>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Call to Action - Join Ministry */}
      <section className="bg-[var(--color-primary)] py-12 md:py-16">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-2xl font-bold text-white">Join a Ministry</h2>
          <p className="mt-2 text-white/90">
            Sign up to serve, get assigned to events, and receive reminders. Ministry heads can
            manage lineups and volunteers.
          </p>
          <Link
            href={joinMinistryHref}
            className="mt-6 inline-flex items-center justify-center rounded-[var(--radius)] bg-white px-6 py-3 text-base font-medium text-[var(--color-primary)] hover:bg-gray-100 focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[var(--color-primary)] focus:outline-none"
          >
            Join Ministry
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-gray-200 bg-[var(--color-card-bg)] py-8">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-sm font-medium text-[var(--color-text-dark)]">Church Ministry</p>
            <nav className="flex flex-wrap items-center justify-center gap-6">
              <Link
                href="/"
                className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
              >
                Home
              </Link>
              <Link
                href="/#events"
                className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
              >
                Events
              </Link>
              <Link
                href="/login"
                className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
              >
                Login
              </Link>
              <Link
                href="/signup"
                className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
              >
                Sign up
              </Link>
            </nav>
          </div>
          <p className="mt-4 text-center text-xs text-[var(--color-text-muted)] sm:text-left">
            Church Ministry Management System
          </p>
        </div>
      </footer>
    </div>
  );
}
