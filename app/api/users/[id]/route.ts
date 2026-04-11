import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessUsers, type PermissionSession } from "@/lib/permissions";
import { userUpdateSchema } from "@/schemas/user";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

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

async function guard(id: string) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const ps = permissionSessionFrom(session);
  if (!canAccessUsers(ps)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  const target = await prisma.user.findUnique({
    where: { id },
    include: { userMinistries: { select: { ministryId: true, role: true } } },
  });
  if (!target) {
    return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }

  // Ministry-head scoping: can only access users whose memberships
  // intersect with the editor's headOfMinistryIds
  if (!session.isAdmin) {
    const targetMinistryIds = new Set(target.userMinistries.map((um) => um.ministryId));
    const overlap = session.headOfMinistryIds.some((mid) => targetMinistryIds.has(mid));
    if (!overlap) {
      return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
    }
  }

  return { session, target };
}

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const g = await guard(id);
  if ("error" in g) return g.error;

  const full = await prisma.user.findUnique({
    where: { id },
    include: {
      userMinistries: {
        include: { ministry: { select: { id: true, name: true } } },
      },
    },
  });
  if (!full) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    user: {
      id: full.id,
      email: full.email,
      name: full.name,
      address: full.address,
      age: full.age,
      birthday: full.birthday?.toISOString() ?? null,
      isAdmin: full.isAdmin,
      status: full.status,
      ministries: full.userMinistries.map((um) => ({
        id: um.ministry.id,
        name: um.ministry.name,
        role: um.role,
      })),
    },
  });
}

export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const g = await guard(id);
  if ("error" in g) return g.error;

  const parsed = userUpdateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.errors[0]?.message ?? "Validation failed" },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const isAdminEditor = g.session.isAdmin;

  // Ministry head editors: drop all basic-info fields silently
  const allowedBasic = isAdminEditor
    ? {
        name: data.name,
        email: data.email,
        address: data.address,
        age: data.age,
        birthday: data.birthday,
        isAdmin: data.isAdmin,
        status: data.status,
      }
    : {};

  // Ministry assignments diff
  let ministryUpdates: { replace: Array<{ ministryId: string; role: "head" | "member" }> } | null =
    null;

  if (data.ministryAssignments !== undefined) {
    if (isAdminEditor) {
      ministryUpdates = { replace: data.ministryAssignments };
    } else {
      // Ministry head: validate that every ministry in the payload is in their scope
      const headSet = new Set(g.session.headOfMinistryIds);
      for (const a of data.ministryAssignments) {
        if (!headSet.has(a.ministryId)) {
          return NextResponse.json(
            { error: "Cannot modify ministries outside your scope" },
            { status: 403 }
          );
        }
      }
      // Merge: preserve out-of-scope memberships, replace in-scope ones
      const preserved = g.target.userMinistries.filter((um) => !headSet.has(um.ministryId));
      ministryUpdates = {
        replace: [
          ...preserved.map((um) => ({
            ministryId: um.ministryId,
            role: um.role as "head" | "member",
          })),
          ...data.ministryAssignments,
        ],
      };
    }
  }

  // Transactional update
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id },
      data: {
        ...(allowedBasic.name !== undefined && { name: allowedBasic.name }),
        ...(allowedBasic.email !== undefined && { email: allowedBasic.email }),
        ...(allowedBasic.address !== undefined && { address: allowedBasic.address }),
        ...(allowedBasic.age !== undefined && { age: allowedBasic.age }),
        ...(allowedBasic.birthday !== undefined && { birthday: allowedBasic.birthday }),
        ...(allowedBasic.isAdmin !== undefined && { isAdmin: allowedBasic.isAdmin }),
        ...(allowedBasic.status !== undefined && { status: allowedBasic.status }),
        updatedAt: new Date(),
      },
    });

    if (ministryUpdates) {
      await tx.userMinistry.deleteMany({ where: { userId: id } });
      if (ministryUpdates.replace.length > 0) {
        await tx.userMinistry.createMany({
          data: ministryUpdates.replace.map((a) => ({
            userId: id,
            ministryId: a.ministryId,
            role: a.role,
          })),
        });
      }
    }
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    // P2003 = foreign key constraint violation (user has authored records)
    return NextResponse.json(
      {
        error:
          "This user has created records (ARFs, lineups, checks, etc.) that reference them. Deactivate instead of deleting.",
      },
      { status: 409 }
    );
  }
}
