import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { RoleSlug } from "@/lib/permissions";

/**
 * GET /api/options/roles
 * Query: for=signup - exclude admin (public signup)
 * When authenticated: admin sees all roles; ministry_head sees non-admin only.
 */
export async function GET(request: NextRequest) {
  const forSignup = request.nextUrl.searchParams.get("for") === "signup";
  const session = await getServerSession(authOptions);
  const roleSlug = (session as { roleSlug?: RoleSlug })?.roleSlug ?? "user";

  const excludeAdmin = forSignup || roleSlug === "ministry_head";
  const roles = await prisma.role.findMany({
    where: excludeAdmin ? { slug: { not: "admin" } } : undefined,
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return NextResponse.json(roles);
}
