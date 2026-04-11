import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const approveBodySchema = z.object({
  ministryIds: z.array(z.string().min(1)).min(1, "Pick at least one ministry"),
});

export async function POST(request: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const parsed = approveBodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.errors[0]?.message ?? "Validation failed" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (user.status !== "pending") {
    return NextResponse.json({ message: "User is not pending approval" }, { status: 409 });
  }

  // Validate every ministry id exists
  const found = await prisma.ministry.findMany({
    where: { id: { in: parsed.data.ministryIds } },
    select: { id: true },
  });
  if (found.length !== parsed.data.ministryIds.length) {
    return NextResponse.json({ message: "Invalid ministry selection." }, { status: 400 });
  }

  // Replace memberships and flip status in one transaction
  await prisma.$transaction(async (tx) => {
    await tx.userMinistry.deleteMany({ where: { userId: id } });
    await tx.userMinistry.createMany({
      data: parsed.data.ministryIds.map((mId) => ({
        userId: id,
        ministryId: mId,
        role: "member" as const,
      })),
    });
    await tx.user.update({
      where: { id },
      data: { status: "active", updatedAt: new Date() },
    });
  });

  return NextResponse.json({ ok: true });
}
