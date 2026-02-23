import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { RoleSlug } from "@/lib/permissions";
import { PageContainer, Card } from "@/components/ui";
import { CalendarView } from "@/features/calendar/CalendarView";

export default async function CalendarPage() {
  const session = await getServerSession(authOptions);
  const roleSlug = (session as { roleSlug?: RoleSlug })?.roleSlug ?? "user";
  const ministryId = (session as { ministryId?: string | null })?.ministryId ?? null;

  const lineups = await prisma.lineup.findMany({
    where: roleSlug === "ministry_head" && ministryId ? { ministryId } : undefined,
    include: { ministry: true },
    orderBy: { date: "asc" },
  });
  const arfs = await prisma.aRF.findMany({
    where: roleSlug === "ministry_head" && ministryId ? { ministryId } : undefined,
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
