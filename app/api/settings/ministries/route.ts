import { getServerSession, type Session } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessSettings, type PermissionSession } from "@/lib/permissions";

function toPs(session: Session | null): PermissionSession {
  return {
    isAdmin: session?.isAdmin ?? false,
    ministryIds: session?.ministryIds ?? [],
    headOfMinistryIds: session?.headOfMinistryIds ?? [],
  };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!canAccessSettings(toPs(session))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const list = await prisma.ministry.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true },
  });
  return NextResponse.json(list);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!canAccessSettings(toPs(session))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  const name = (body.name as string)?.trim();
  if (!name) {
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }
  const slug = name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
  const created = await prisma.ministry.create({
    data: { name, slug, updatedAt: new Date() },
  });
  return NextResponse.json(created);
}
