import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageInstrumentsAndSingers } from "@/lib/permissions";
import type { RoleSlug } from "@/lib/permissions";

export async function GET() {
  const session = await getServerSession(authOptions);
  const roleSlug = (session as { roleSlug?: RoleSlug }).roleSlug ?? "user";
  if (!canManageInstrumentsAndSingers(roleSlug)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const list = await prisma.instrument.findMany({
    orderBy: { name: "asc" },
  });
  return NextResponse.json(list);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const roleSlug = (session as { roleSlug?: RoleSlug }).roleSlug ?? "user";
  if (!canManageInstrumentsAndSingers(roleSlug)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  const name = (body.name as string)?.trim();
  if (!name) {
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }
  const created = await prisma.instrument.create({ data: { name } });
  return NextResponse.json(created);
}
