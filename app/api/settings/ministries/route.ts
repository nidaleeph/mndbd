import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessSettings } from "@/lib/permissions";
import type { RoleSlug } from "@/lib/permissions";

export async function GET() {
  const session = await getServerSession(authOptions);
  const roleSlug = (session as { roleSlug?: RoleSlug }).roleSlug ?? "user";
  if (!canAccessSettings(roleSlug)) {
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
  const roleSlug = (session as { roleSlug?: RoleSlug }).roleSlug ?? "user";
  if (!canAccessSettings(roleSlug)) {
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
