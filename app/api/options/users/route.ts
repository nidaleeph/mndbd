import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessUsers, type PermissionSession } from "@/lib/permissions";

/**
 * GET /api/options/users
 * Query: ministryId (optional) - filter by ministry for ministry heads
 * Returns: { id, name, email }[] for dropdowns
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ps: PermissionSession = {
    isAdmin: session.isAdmin,
    ministryIds: session.ministryIds,
    headOfMinistryIds: session.headOfMinistryIds,
  };

  if (!canAccessUsers(ps)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const filterMinistryId = searchParams.get("ministryId");

  // Admin: optionally filter by a specific ministry, otherwise all active users.
  // Ministry head (non-admin): scoped to ministries they head.
  let where: Prisma.UserWhereInput;
  if (ps.isAdmin) {
    where = filterMinistryId
      ? { status: "active", userMinistries: { some: { ministryId: filterMinistryId } } }
      : { status: "active" };
  } else if (ps.headOfMinistryIds.length > 0) {
    const scopedMinistryIds =
      filterMinistryId && ps.headOfMinistryIds.includes(filterMinistryId)
        ? [filterMinistryId]
        : ps.headOfMinistryIds;
    where = {
      status: "active",
      userMinistries: { some: { ministryId: { in: scopedMinistryIds } } },
    };
  } else {
    where = { id: "none" };
  }

  const users = await prisma.user.findMany({
    where,
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true },
  });
  return NextResponse.json(users);
}
