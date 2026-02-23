import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { RoleSlug } from "@/lib/permissions";
import { canAccessUsers } from "@/lib/permissions";
import { userCreateSchema } from "@/schemas/user";

/**
 * POST /api/users
 * Create a new user. Auth: admin or ministry head (create only in their ministries).
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const roleSlug = (session as { roleSlug?: RoleSlug }).roleSlug ?? "user";
  const ministryIds = (session as { ministryIds?: string[] }).ministryIds ?? [];

  if (!canAccessUsers(roleSlug)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = userCreateSchema.safeParse({
    ...body,
    ministryIds: body.ministryIds ?? [],
  });
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.errors[0]?.message ?? "Validation failed" },
      { status: 400 }
    );
  }

  const targetMinistryIds = parsed.data.ministryIds ?? [];
  if (roleSlug === "ministry_head") {
    const allAllowed = targetMinistryIds.every((id) => ministryIds.includes(id));
    if (!allAllowed) {
      return NextResponse.json(
        { error: "You can only assign users to your ministries" },
        { status: 403 }
      );
    }
    const adminRole = await prisma.role.findUnique({ where: { slug: "admin" } });
    if (adminRole && parsed.data.roleId === adminRole.id) {
      return NextResponse.json({ error: "Cannot assign admin role" }, { status: 403 });
    }
  }

  const existing = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });
  if (existing) {
    return NextResponse.json({ message: "Email already registered" }, { status: 400 });
  }

  const hashedPassword = await bcrypt.hash(parsed.data.password, 10);
  const primaryMinistryId = targetMinistryIds[0] ?? null;
  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      hashedPassword,
      roleId: parsed.data.roleId,
      ministryId: primaryMinistryId,
      userMinistries: {
        create: targetMinistryIds.map((ministryId) => ({ ministryId })),
      },
    },
  });
  return NextResponse.json({ id: user.id });
}
