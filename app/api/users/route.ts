import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessUsers, type PermissionSession } from "@/lib/permissions";
import { userCreateSchema } from "@/schemas/user";

export const dynamic = "force-dynamic";

function permissionSessionFrom(s: {
  isAdmin: boolean;
  ministryIds: string[];
  headOfMinistryIds: string[];
}): PermissionSession {
  return {
    isAdmin: s.isAdmin,
    ministryIds: s.ministryIds,
    headOfMinistryIds: s.headOfMinistryIds,
  };
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ps = permissionSessionFrom(session);
  if (!canAccessUsers(ps)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tab = new URL(request.url).searchParams.get("tab") ?? "active";
  if (tab !== "active" && tab !== "pending") {
    return NextResponse.json({ message: "Invalid tab" }, { status: 400 });
  }

  // Pending tab is admin-only
  if (tab === "pending" && !session.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Admin sees everyone; ministry head sees users whose memberships
  // intersect their headOfMinistryIds (Active tab only).
  const where = session.isAdmin
    ? { status: tab === "pending" ? ("pending" as const) : { not: "pending" as const } }
    : {
        status: { not: "pending" as const },
        userMinistries: {
          some: { ministryId: { in: session.headOfMinistryIds } },
        },
      };

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      userMinistries: {
        include: { ministry: { select: { id: true, name: true } } },
      },
    },
  });

  const shaped = users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    isAdmin: u.isAdmin,
    status: u.status,
    createdAt: u.createdAt.toISOString(),
    ministries: u.userMinistries.map((um) => ({
      id: um.ministry.id,
      name: um.ministry.name,
      role: um.role,
    })),
  }));

  return NextResponse.json({ users: shaped });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = userCreateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.errors[0]?.message ?? "Validation failed" },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    return NextResponse.json({ message: "Email already registered." }, { status: 400 });
  }

  // Validate every ministry id exists
  const ministryIds = parsed.data.ministryAssignments.map((a) => a.ministryId);
  if (ministryIds.length > 0) {
    const found = await prisma.ministry.findMany({
      where: { id: { in: ministryIds } },
      select: { id: true },
    });
    if (found.length !== ministryIds.length) {
      return NextResponse.json({ message: "Invalid ministry selection." }, { status: 400 });
    }
  }

  const hashedPassword = await bcrypt.hash(parsed.data.password, 10);
  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      hashedPassword,
      isAdmin: parsed.data.isAdmin,
      status: "active", // admin-created users skip the pending queue
      updatedAt: new Date(),
      userMinistries: {
        create: parsed.data.ministryAssignments.map((a) => ({
          ministryId: a.ministryId,
          role: a.role,
        })),
      },
    },
  });

  return NextResponse.json({ id: user.id });
}
