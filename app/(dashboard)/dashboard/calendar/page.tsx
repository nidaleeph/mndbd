import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageContainer, Card } from "@/components/ui";
import { CalendarView } from "@/features/calendar/CalendarView";

export default async function CalendarPage() {
  const session = await getServerSession(authOptions);
  const isAdmin = session?.isAdmin ?? false;
  const headOfMinistryIds = session?.headOfMinistryIds ?? [];

  // Admin sees all events. Non-admin ministry heads see only events for ministries
  // they head. Plain members see all events too (calendar is read-only for them).
  const scopedWhere =
    !isAdmin && headOfMinistryIds.length > 0
      ? { ministryId: { in: headOfMinistryIds } }
      : undefined;

  const lineups = await prisma.lineup.findMany({
    where: scopedWhere,
    include: { ministry: true },
    orderBy: { date: "asc" },
  });
  const arfs = await prisma.aRF.findMany({
    where: scopedWhere,
    include: { ministry: true },
  });

  const events = [
    ...lineups.map((l) => ({
      id: l.id,
      type: "lineup" as const,
      title: l.eventName,
      date: l.date,
      ministryName: l.ministry.name,
    })),
    ...arfs.map((a) => ({
      id: a.id,
      type: "arf" as const,
      title: a.eventName,
      date: a.requestedDate,
      ministryName: a.ministry.name,
    })),
  ];

  return (
    <PageContainer title="Calendar" description="Lineups and events">
      <Card>
        <CalendarView events={events} />
      </Card>
    </PageContainer>
  );
}
