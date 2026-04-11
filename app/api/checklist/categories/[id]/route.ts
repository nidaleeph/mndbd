import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditChecklistTemplate, type RoleSlug } from "@/lib/permissions";
import { getMultimediaMinistryId, notifyTemplateChangeIfRunOpen } from "@/lib/checklist";
import { checklistCategoryPatchSchema } from "@/schemas/checklist";
import { publishTemplateChanged } from "@/services/checklistEvents";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

async function guard() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const roleSlug = (session.roleSlug ?? "user") as RoleSlug;
  const ministryIds = session.ministryIds ?? [];
  const multimediaMinistryId = await getMultimediaMinistryId();
  if (!multimediaMinistryId) {
    return {
      error: NextResponse.json({ error: "Multimedia ministry not found" }, { status: 500 }),
    };
  }
  if (!canEditChecklistTemplate(roleSlug, ministryIds, multimediaMinistryId)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session, multimediaMinistryId };
}

export async function PATCH(request: Request, { params }: Params) {
  const g = await guard();
  if ("error" in g) return g.error;
  const { id } = await params;

  const parsed = checklistCategoryPatchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.errors[0]?.message ?? "Validation failed" },
      { status: 400 }
    );
  }

  const template = await prisma.checklistTemplate.findUnique({
    where: { ministryId: g.multimediaMinistryId },
    select: { id: true },
  });
  if (!template) return NextResponse.json({ error: "No template" }, { status: 404 });

  const category = await prisma.checklistCategory.update({
    where: { id },
    data: {
      name: parsed.data.name,
      sortOrder: parsed.data.sortOrder,
      updatedAt: new Date(),
    },
  });

  await publishTemplateChanged("category-updated", category.id);

  const actor = await prisma.user.findUnique({
    where: { id: g.session.userId },
    select: { name: true },
  });
  await notifyTemplateChangeIfRunOpen({
    multimediaMinistryId: g.multimediaMinistryId,
    templateId: template.id,
    actorUserId: g.session.userId,
    actorName: actor?.name ?? "Someone",
  });

  return NextResponse.json(category);
}

export async function DELETE(_request: Request, { params }: Params) {
  const g = await guard();
  if ("error" in g) return g.error;
  const { id } = await params;

  const template = await prisma.checklistTemplate.findUnique({
    where: { ministryId: g.multimediaMinistryId },
    select: { id: true },
  });
  if (!template) return NextResponse.json({ error: "No template" }, { status: 404 });

  // Soft-delete category and cascade archive to its items so they disappear from live view.
  const now = new Date();
  await prisma.$transaction([
    prisma.checklistCategory.update({
      where: { id },
      data: { archivedAt: now, updatedAt: now },
    }),
    prisma.checklistItem.updateMany({
      where: { categoryId: id, archivedAt: null },
      data: { archivedAt: now, updatedAt: now },
    }),
  ]);

  await publishTemplateChanged("category-archived", id);

  const actor = await prisma.user.findUnique({
    where: { id: g.session.userId },
    select: { name: true },
  });
  await notifyTemplateChangeIfRunOpen({
    multimediaMinistryId: g.multimediaMinistryId,
    templateId: template.id,
    actorUserId: g.session.userId,
    actorName: actor?.name ?? "Someone",
  });

  return NextResponse.json({ ok: true });
}
