/**
 * GET /api/profile - Fetch current user's profile (own data only).
 * PUT /api/profile - Update current user's profile.
 */

import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { profileUpdateSchema } from "@/schemas/profile";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: {
      role: { select: { id: true, name: true, slug: true } },
      ministry: { select: { id: true, name: true } },
      userMinistries: { include: { ministry: { select: { id: true, name: true } } } },
    },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const ministries = [
    ...(user.ministry ? [user.ministry] : []),
    ...user.userMinistries.map((um) => um.ministry),
  ].filter((m, i, arr) => arr.findIndex((x) => x.id === m.id) === i);

  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    address: user.address ?? "",
    age: user.age ?? null,
    birthday: user.birthday ? user.birthday.toISOString().slice(0, 10) : null,
    role: user.role,
    ministries,
  });
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = profileUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.errors[0]?.message ?? "Validation failed" },
      { status: 400 }
    );
  }

  if (parsed.data.email) {
    const existing = await prisma.user.findFirst({
      where: { email: parsed.data.email, NOT: { id: session.userId } },
    });
    if (existing) {
      return NextResponse.json({ message: "Email already in use" }, { status: 400 });
    }
  }

  const updateData: {
    name: string;
    email: string;
    address?: string | null;
    age?: number | null;
    birthday?: Date | null;
    hashedPassword?: string;
  } = {
    name: parsed.data.name,
    email: parsed.data.email,
    address: parsed.data.address ?? null,
    age: parsed.data.age ?? null,
    birthday: parsed.data.birthday ? new Date(parsed.data.birthday) : null,
  };

  if (parsed.data.password && parsed.data.password.trim().length > 0) {
    updateData.hashedPassword = await bcrypt.hash(parsed.data.password, 10);
  }

  await prisma.user.update({
    where: { id: session.userId },
    data: updateData,
  });

  return NextResponse.json({ ok: true });
}
