import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { RoleSlug } from "@/lib/permissions";
import { canAccessPrayers, canViewAllPrayers } from "@/lib/permissions";
import { prayerSchema } from "@/schemas/prayer";
import { getParakletosMemberIds } from "@/lib/notificationRecipients";
import { createNotificationsForUserIds } from "@/services/notificationService";

const PARAKLETOS_SLUG = "parakletos";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canAccessPrayers((session as { roleSlug?: RoleSlug }).roleSlug ?? "user")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parakletos = await prisma.ministry.findUnique({
    where: { slug: PARAKLETOS_SLUG },
  });
  if (!parakletos) {
    return NextResponse.json([]);
  }

  const roleSlug = (session as { roleSlug?: RoleSlug }).roleSlug ?? "user";
  const ministryIds = (session as { ministryIds?: string[] }).ministryIds ?? [];
  const viewAll = canViewAllPrayers(roleSlug, ministryIds, parakletos.id);

  const where = viewAll
    ? { ministryId: parakletos.id }
    : { ministryId: parakletos.id, createdById: session.userId };

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
  if (!canAccessPrayers((session as { roleSlug?: RoleSlug }).roleSlug ?? "user")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parakletos = await prisma.ministry.findUnique({
    where: { slug: PARAKLETOS_SLUG },
  });
  if (!parakletos) {
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
      ministryId: parakletos.id,
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
      ministryId: parakletos.id,
    }).catch(() => {});
  }

  return NextResponse.json(prayer);
}
