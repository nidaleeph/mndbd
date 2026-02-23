import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessUsers } from "@/lib/permissions";
import type { RoleSlug } from "@/lib/permissions";

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
  const roleSlug = (session as { roleSlug?: RoleSlug }).roleSlug ?? "user";
  const ministryId = (session as { ministryId?: string | null }).ministryId ?? null;

  if (!canAccessUsers(roleSlug)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const filterMinistryId = searchParams.get("ministryId");

  const where =
    roleSlug === "admin"
      ? filterMinistryId
        ? { ministryId: filterMinistryId, status: "active" as const }
        : { status: "active" as const }
      : ministryId
        ? { ministryId, status: "active" as const }
        : { id: "none" as const };

  const users = await prisma.user.findMany({
    where,
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true },
  });
  return NextResponse.json(users);
}
