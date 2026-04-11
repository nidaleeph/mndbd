import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessPrayers, canViewAllPrayers, type PermissionSession } from "@/lib/permissions";
import { getParakletosMinistryId } from "@/lib/checklist";
import { prayerSchema } from "@/schemas/prayer";
import { getParakletosMemberIds } from "@/lib/notificationRecipients";
import { createNotificationsForUserIds } from "@/services/notificationService";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canAccessPrayers()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parakletosId = await getParakletosMinistryId();
  if (!parakletosId) {
    return NextResponse.json([]);
  }

  const ps: PermissionSession = {
    isAdmin: session.isAdmin,
    ministryIds: session.ministryIds,
    headOfMinistryIds: session.headOfMinistryIds,
  };
  const viewAll = canViewAllPrayers(ps, parakletosId);

  const where = viewAll
    ? { ministryId: parakletosId }
    : { ministryId: parakletosId, createdById: session.userId };

  const prayers = await prisma.prayer.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { name: true } } },
  });

  return NextResponse.json(prayers);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canAccessPrayers()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parakletosId = await getParakletosMinistryId();
  if (!parakletosId) {
    return NextResponse.json({ error: "Parakletos ministry not found" }, { status: 500 });
  }

  const body = await request.json();
  const parsed = prayerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.errors[0]?.message ?? "Validation failed" },
      { status: 400 }
    );
  }

  const prayer = await prisma.prayer.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      status: parsed.data.status ?? "pending",
      createdById: session.userId,
      ministryId: parakletosId,
      updatedAt: new Date(),
    },
    include: { createdBy: { select: { name: true } } },
  });

  // Notify all Parakletos members (exclude creator)
  const parakletosMemberIds = await getParakletosMemberIds();
  const recipientIds = parakletosMemberIds.filter((uid) => uid !== session.userId);
  if (recipientIds.length > 0) {
    await createNotificationsForUserIds(recipientIds, {
      type: "prayer_created",
      title: "New prayer request",
      body: prayer.title,
      link: `/dashboard/prayers/${prayer.id}`,
      ministryId: parakletosId,
    }).catch(() => {});
  }

  return NextResponse.json(prayer);
}
