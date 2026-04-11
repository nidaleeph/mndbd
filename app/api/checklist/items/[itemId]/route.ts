import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditChecklistTemplate, type PermissionSession } from "@/lib/permissions";
import { getMultimediaMinistryId, notifyTemplateChangeIfRunOpen } from "@/lib/checklist";
import { checklistItemPatchSchema } from "@/schemas/checklist";
import { publishTemplateChanged } from "@/services/checklistEvents";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ itemId: string }> };

async function guard() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const ps: PermissionSession = {
    isAdmin: session.isAdmin,
    ministryIds: session.ministryIds,
    headOfMinistryIds: session.headOfMinistryIds,
  };
  const multimediaMinistryId = await getMultimediaMinistryId();
  if (!multimediaMinistryId) {
    return {
      error: NextResponse.json({ error: "Multimedia ministry not found" }, { status: 500 }),
    };
  }
  if (!canEditChecklistTemplate(ps, multimediaMinistryId)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session, multimediaMinistryId };
}

export async function PATCH(request: Request, { params }: Params) {
  const g = await guard();
  if ("error" in g) return g.error;
  const { itemId } = await params;

  const parsed = checklistItemPatchSchema.safeParse(await request.json());
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

  // If reparenting, confirm the new category is in the Multimedia template.
  if (parsed.data.categoryId) {
    const newCat = await prisma.checklistCategory.findUnique({
      where: { id: parsed.data.categoryId },
      include: { template: { select: { ministryId: true } } },
    });
    if (!newCat || newCat.archivedAt || newCat.template.ministryId !== g.multimediaMinistryId) {
      return NextResponse.json({ message: "Target category not found" }, { status: 404 });
    }
  }

  const item = await prisma.checklistItem.update({
    where: { id: itemId },
    data: {
      label: parsed.data.label,
      sortOrder: parsed.data.sortOrder,
      categoryId: parsed.data.categoryId,
      updatedAt: new Date(),
    },
  });

  await publishTemplateChanged("item-updated", item.id);

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

  return NextResponse.json(item);
}

export async function DELETE(_request: Request, { params }: Params) {
  const g = await guard();
  if ("error" in g) return g.error;
  const { itemId } = await params;

  const template = await prisma.checklistTemplate.findUnique({
    where: { ministryId: g.multimediaMinistryId },
    select: { id: true },
  });
  if (!template) return NextResponse.json({ error: "No template" }, { status: 404 });

  await prisma.checklistItem.update({
    where: { id: itemId },
    data: { archivedAt: new Date(), updatedAt: new Date() },
  });

  await publishTemplateChanged("item-archived", itemId);

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
