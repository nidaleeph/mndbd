import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { RoleSlug } from "@/lib/permissions";
import { canAccessUsers } from "@/lib/permissions";
import { userUpdateSchema } from "@/schemas/user";

async function checkUserAccess(
  userId: string,
  session: { roleSlug?: RoleSlug; ministryIds?: string[] }
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { ministry: true, role: true, userMinistries: { select: { ministryId: true } } },
  });
  if (!user) return { error: "Not found" as const, status: 404 as const };
  const roleSlug = (session.roleSlug ?? "user") as RoleSlug;
  const ministryIds = session.ministryIds ?? [];
  if (!canAccessUsers(roleSlug)) {
    return { error: "Forbidden" as const, status: 403 as const };
  }
  if (roleSlug === "ministry_head") {
    const userMinistryIds = user.userMinistries.map((um) => um.ministryId);
    if (user.ministryId && !userMinistryIds.includes(user.ministryId)) {
      userMinistryIds.push(user.ministryId);
    }
    const hasOverlap = userMinistryIds.some((mid) => ministryIds.includes(mid));
    if (!hasOverlap) {
      return { error: "Forbidden" as const, status: 403 as const };
    }
  }
  return { user };
}

/**
 * GET /api/users/[id]
 * Fetch a single user. Auth: admin or ministry head (own ministry).
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const check = await checkUserAccess(
    id,
    session as { roleSlug?: RoleSlug; ministryIds?: string[] }
  );
  if ("error" in check) return NextResponse.json({ error: check.error }, { status: check.status });
  const userMinistryIds = check.user.userMinistries?.map((um) => um.ministryId) ?? [];
  if (check.user.ministryId && !userMinistryIds.includes(check.user.ministryId)) {
    userMinistryIds.unshift(check.user.ministryId);
  }
  return NextResponse.json({
    ...check.user,
    ministryIds: userMinistryIds,
    hashedPassword: undefined,
    userMinistries: undefined,
  });
}

/**
 * PUT /api/users/[id]
 * Update user. Auth: admin or ministry head (own ministry).
 */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const roleSlug = (session as { roleSlug?: RoleSlug }).roleSlug ?? "user";
  const ministryIds = (session as { ministryIds?: string[] }).ministryIds ?? [];
  const { id } = await params;
  const check = await checkUserAccess(
    id,
    session as { roleSlug?: RoleSlug; ministryIds?: string[] }
  );
  if ("error" in check) return NextResponse.json({ error: check.error }, { status: check.status });

  const body = await request.json().catch(() => ({}));
  const parsed = userUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.errors[0]?.message ?? "Validation failed" },
      { status: 400 }
    );
  }

  if (roleSlug === "ministry_head") {
    if (parsed.data.ministryIds !== undefined) {
      const allAllowed = parsed.data.ministryIds.every((mid) => ministryIds.includes(mid));
      if (!allAllowed) {
        return NextResponse.json(
          { error: "Cannot assign user to ministries outside your scope" },
          { status: 403 }
        );
      }
    }
    const adminRole = await prisma.role.findUnique({ where: { slug: "admin" } });
    if (adminRole && parsed.data.roleId === adminRole.id) {
      return NextResponse.json({ error: "Cannot assign admin role" }, { status: 403 });
    }
  }

  if (parsed.data.email) {
    const existing = await prisma.user.findFirst({
      where: { email: parsed.data.email, NOT: { id } },
    });
    if (existing) {
      return NextResponse.json({ message: "Email already in use" }, { status: 400 });
    }
  }

  const updateData: {
    name?: string;
    email?: string;
    ministryId?: string | null;
    roleId?: string;
    status?: string;
  } = {
    ...(parsed.data.name !== undefined && { name: parsed.data.name }),
    ...(parsed.data.email !== undefined && { email: parsed.data.email }),
    ...(parsed.data.roleId !== undefined && { roleId: parsed.data.roleId }),
    ...(parsed.data.status !== undefined && { status: parsed.data.status }),
  };

  if (parsed.data.ministryIds !== undefined) {
    updateData.ministryId = parsed.data.ministryIds[0] ?? null;
  }

  const user = await prisma.user.update({
    where: { id },
    data: updateData,
  });

  if (parsed.data.ministryIds !== undefined) {
    await prisma.userMinistry.deleteMany({ where: { userId: id } });
    if (parsed.data.ministryIds.length > 0) {
      await prisma.userMinistry.createMany({
        data: parsed.data.ministryIds.map((ministryId) => ({ userId: id, ministryId })),
      });
    }
  }
  return NextResponse.json({ id: user.id });
}

/**
 * DELETE /api/users/[id]
 * Deactivate user (set status to inactive). Auth: admin or ministry head (own ministry).
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const check = await checkUserAccess(
    id,
    session as { roleSlug?: RoleSlug; ministryIds?: string[] }
  );
  if ("error" in check) return NextResponse.json({ error: check.error }, { status: check.status });

  await prisma.user.update({
    where: { id },
    data: { status: "inactive" },
  });
  return NextResponse.json({ ok: true });
}
