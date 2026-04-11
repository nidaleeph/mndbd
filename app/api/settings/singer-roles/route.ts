import { getServerSession, type Session } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageInstrumentsAndSingers, type PermissionSession } from "@/lib/permissions";

function toPs(session: Session | null): PermissionSession {
  return {
    isAdmin: session?.isAdmin ?? false,
    ministryIds: session?.ministryIds ?? [],
    headOfMinistryIds: session?.headOfMinistryIds ?? [],
  };
}

export async function GET() {
  // GET is open to any authenticated user — lineup assignment forms need this
  // list. Mutating endpoints below are admin-only.
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const list = await prisma.singerRole.findMany({
    orderBy: { name: "asc" },
  });
  return NextResponse.json(list);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!canManageInstrumentsAndSingers(toPs(session))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  const name = (body.name as string)?.trim();
  if (!name) {
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }
  const created = await prisma.singerRole.create({ data: { name } });
  return NextResponse.json(created);
}
