import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditChecklistTemplate, type RoleSlug } from "@/lib/permissions";
import { getMultimediaMinistryId, notifyTemplateChangeIfRunOpen } from "@/lib/checklist";
import { checklistCategoryCreateSchema } from "@/schemas/checklist";
import { publishTemplateChanged } from "@/services/checklistEvents";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const roleSlug = (session.roleSlug ?? "user") as RoleSlug;
  const ministryIds = session.ministryIds ?? [];
  const multimediaMinistryId = await getMultimediaMinistryId();
  if (!multimediaMinistryId) {
    return NextResponse.json({ error: "Multimedia ministry not found" }, { status: 500 });
  }
  if (!canEditChecklistTemplate(roleSlug, ministryIds, multimediaMinistryId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = checklistCategoryCreateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.errors[0]?.message ?? "Validation failed" },
      { status: 400 }
    );
  }

  const template = await prisma.checklistTemplate.findUnique({
    where: { ministryId: multimediaMinistryId },
    select: { id: true },
  });
  if (!template) {
    return NextResponse.json({ error: "No template" }, { status: 404 });
  }

  const sortOrder =
    parsed.data.sortOrder ??
    ((await prisma.checklistCategory.count({
      where: { templateId: template.id, archivedAt: null },
    })) as number);

  const category = await prisma.checklistCategory.create({
    data: {
      templateId: template.id,
      name: parsed.data.name,
      sortOrder,
      updatedAt: new Date(),
    },
  });

  await publishTemplateChanged("category-added", category.id);

  const actor = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { name: true },
  });
  await notifyTemplateChangeIfRunOpen({
    multimediaMinistryId,
    templateId: template.id,
    actorUserId: session.userId,
    actorName: actor?.name ?? "Someone",
  });

  return NextResponse.json(category);
}
