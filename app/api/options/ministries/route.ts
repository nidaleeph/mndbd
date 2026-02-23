import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/options/ministries
 * Returns active ministries.
 * Query: context=user-create - for ministry_head, returns only their ministry.
 */
export async function GET(request: NextRequest) {
  const context = request.nextUrl.searchParams.get("context");
  const session = await getServerSession(authOptions);
  const ministryIds = (session as { ministryIds?: string[] })?.ministryIds ?? [];

  const where =
    context === "user-create" && ministryIds.length > 0
      ? { active: true, id: { in: ministryIds } }
      : { active: true };

  const ministries = await prisma.ministry.findMany({
    where,
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return NextResponse.json(ministries);
}
