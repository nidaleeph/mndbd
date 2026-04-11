import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditChecklistTemplate, type PermissionSession } from "@/lib/permissions";
import { getMultimediaMinistryId, notifyTemplateChangeIfRunOpen } from "@/lib/checklist";
import { checklistItemCreateSchema } from "@/schemas/checklist";
import { publishTemplateChanged } from "@/services/checklistEvents";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
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
  if (!canEditChecklistTemplate(ps, multimediaMinistryId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = checklistItemCreateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.errors[0]?.message ?? "Validation failed" },
      { status: 400 }
    );
  }

  // Confirm the target category belongs to the Multimedia template.
  const category = await prisma.checklistCategory.findUnique({
    where: { id: parsed.data.categoryId },
    include: { template: { select: { id: true, ministryId: true } } },
  });
  if (!category || category.archivedAt || category.template.ministryId !== multimediaMinistryId) {
    return NextResponse.json({ message: "Category not found" }, { status: 404 });
  }

  const sortOrder =
    parsed.data.sortOrder ??
    ((await prisma.checklistItem.count({
      where: { categoryId: category.id, archivedAt: null },
    })) as number);

  const item = await prisma.checklistItem.create({
    data: {
      categoryId: category.id,
      label: parsed.data.label,
      sortOrder,
      updatedAt: new Date(),
    },
  });

  await publishTemplateChanged("item-added", item.id);

  const actor = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { name: true },
  });
  await notifyTemplateChangeIfRunOpen({
    multimediaMinistryId,
    templateId: category.template.id,
    actorUserId: session.userId,
    actorName: actor?.name ?? "Someone",
  });

  return NextResponse.json(item);
}
