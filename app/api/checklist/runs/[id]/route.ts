import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewChecklistHistory, type PermissionSession } from "@/lib/permissions";
import { getMultimediaMinistryId } from "@/lib/checklist";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ps: PermissionSession = {
    isAdmin: session.isAdmin,
    ministryIds: session.ministryIds,
    headOfMinistryIds: session.headOfMinistryIds,
  };
  const multimediaMinistryId = await getMultimediaMinistryId();
  if (!multimediaMinistryId) {
    return NextResponse.json({ error: "Multimedia ministry not found" }, { status: 500 });
  }
  if (!canViewChecklistHistory(ps, multimediaMinistryId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const run = await prisma.checklistRun.findUnique({
    where: { id },
    include: {
      startedBy: { select: { id: true, name: true } },
      closedBy: { select: { id: true, name: true } },
      template: {
        include: {
          categories: {
            orderBy: { sortOrder: "asc" },
            include: {
              items: {
                orderBy: { sortOrder: "asc" },
                select: { id: true, label: true, archivedAt: true, createdAt: true },
              },
            },
          },
        },
      },
      checks: {
        include: {
          checkedBy: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!run || run.template.ministryId !== multimediaMinistryId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ run });
}
