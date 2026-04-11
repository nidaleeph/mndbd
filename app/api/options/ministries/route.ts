import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/options/ministries
 * Returns active ministries.
 * Query: context=user-create - for non-admins, scope to ministries they head.
 */
export async function GET(request: NextRequest) {
  const context = request.nextUrl.searchParams.get("context");
  const session = await getServerSession(authOptions);
  const isAdmin = session?.isAdmin ?? false;
  const headOfMinistryIds = session?.headOfMinistryIds ?? [];

  const where =
    context === "user-create" && !isAdmin && headOfMinistryIds.length > 0
      ? { active: true, id: { in: headOfMinistryIds } }
      : { active: true };

  const ministries = await prisma.ministry.findMany({
    where,
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return NextResponse.json(ministries);
}
