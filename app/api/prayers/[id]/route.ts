import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { RoleSlug } from "@/lib/permissions";
import { canAccessPrayers, canManagePrayer, canViewAllPrayers } from "@/lib/permissions";
import { prayerSchema } from "@/schemas/prayer";
import { createNotification } from "@/services/notificationService";

const PARAKLETOS_SLUG = "parakletos";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canAccessPrayers((session as { roleSlug?: RoleSlug }).roleSlug ?? "user")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const prayer = await prisma.prayer.findUnique({
    where: { id },
    include: { createdBy: { select: { name: true } }, ministry: true },
  });
  if (!prayer) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const parakletos = await prisma.ministry.findUnique({
    where: { slug: PARAKLETOS_SLUG },
  });
  if (!parakletos || prayer.ministryId !== parakletos.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const roleSlug = (session as { roleSlug?: RoleSlug }).roleSlug ?? "user";
  const ministryIds = (session as { ministryIds?: string[] }).ministryIds ?? [];
  const viewAll = canViewAllPrayers(roleSlug, ministryIds, parakletos.id);

  if (!viewAll && prayer.createdById !== session.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(prayer);
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canAccessPrayers((session as { roleSlug?: RoleSlug }).roleSlug ?? "user")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.prayer.findUnique({
    where: { id },
    include: { ministry: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const parakletos = await prisma.ministry.findUnique({
    where: { slug: PARAKLETOS_SLUG },
  });
  if (!parakletos || existing.ministryId !== parakletos.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const roleSlug = (session as { roleSlug?: RoleSlug }).roleSlug ?? "user";
  const ministryIds = (session as { ministryIds?: string[] }).ministryIds ?? [];
  const perms = canManagePrayer(
    roleSlug,
    ministryIds,
    parakletos.id,
    existing.createdById,
    session.userId
  );

  if (!perms.canEdit) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = prayerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.errors[0]?.message ?? "Validation failed" },
      { status: 400 }
    );
  }

  const prayer = await prisma.prayer.update({
    where: { id },
    data: {
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      status: parsed.data.status ?? existing.status,
      updatedAt: new Date(),
    },
    include: { createdBy: { select: { name: true } } },
  });

  return NextResponse.json(prayer);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canAccessPrayers((session as { roleSlug?: RoleSlug }).roleSlug ?? "user")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.prayer.findUnique({
    where: { id },
    include: { ministry: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const parakletos = await prisma.ministry.findUnique({
    where: { slug: PARAKLETOS_SLUG },
  });
  if (!parakletos || existing.ministryId !== parakletos.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const roleSlug = (session as { roleSlug?: RoleSlug }).roleSlug ?? "user";
  const ministryIds = (session as { ministryIds?: string[] }).ministryIds ?? [];
  const perms = canManagePrayer(
    roleSlug,
    ministryIds,
    parakletos.id,
    existing.createdById,
    session.userId
  );

  if (!perms.canSetStatus) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const newStatus = body.status as string | undefined;
  if (!newStatus || !["pending", "prayed_for"].includes(newStatus)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const prayer = await prisma.prayer.update({
    where: { id },
    data: { status: newStatus, updatedAt: new Date() },
    include: { createdBy: { select: { name: true } } },
  });

  // Notify creator when prayer is marked as prayed for (exclude actor)
  if (newStatus === "prayed_for" && existing.createdById !== session.userId) {
    await createNotification({
      userId: existing.createdById,
      type: "prayer_prayed_for",
      title: "Your prayer was prayed for",
      body: `"${existing.title}" has been marked as prayed for`,
      link: `/dashboard/prayers/${id}`,
      ministryId: existing.ministryId,
    }).catch(() => {});
  }

  return NextResponse.json(prayer);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canAccessPrayers((session as { roleSlug?: RoleSlug }).roleSlug ?? "user")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.prayer.findUnique({
    where: { id },
    include: { ministry: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const parakletos = await prisma.ministry.findUnique({
    where: { slug: PARAKLETOS_SLUG },
  });
  if (!parakletos || existing.ministryId !== parakletos.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const roleSlug = (session as { roleSlug?: RoleSlug }).roleSlug ?? "user";
  const ministryIds = (session as { ministryIds?: string[] }).ministryIds ?? [];
  const perms = canManagePrayer(
    roleSlug,
    ministryIds,
    parakletos.id,
    existing.createdById,
    session.userId
  );

  if (!perms.canDelete) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.prayer.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
