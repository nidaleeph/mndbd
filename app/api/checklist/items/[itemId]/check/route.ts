import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canToggleChecklistItem, type PermissionSession } from "@/lib/permissions";
import { getMultimediaMinistryId } from "@/lib/checklist";
import { publishItemChecked, publishItemUnchecked } from "@/services/checklistEvents";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ itemId: string }> };

async function resolveAuth() {
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
  if (!canToggleChecklistItem(ps, multimediaMinistryId)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session, multimediaMinistryId };
}

async function loadOpenRunAndItem(itemId: string, multimediaMinistryId: string) {
  const template = await prisma.checklistTemplate.findUnique({
    where: { ministryId: multimediaMinistryId },
    select: { id: true },
  });
  if (!template) return { error: "No checklist template" as const };

  const run = await prisma.checklistRun.findFirst({
    where: { templateId: template.id, closedAt: null },
    orderBy: { startedAt: "desc" },
  });
  if (!run) return { error: "No open run" as const };

  const item = await prisma.checklistItem.findUnique({
    where: { id: itemId },
    include: { category: { select: { name: true, templateId: true } } },
  });
  if (!item || item.archivedAt) return { error: "Item not found" as const };
  if (item.category.templateId !== template.id) return { error: "Item not in template" as const };

  return { run, item };
}

export async function POST(_request: Request, { params }: Params) {
  const { itemId } = await params;
  const auth = await resolveAuth();
  if ("error" in auth) return auth.error;

  const loaded = await loadOpenRunAndItem(itemId, auth.multimediaMinistryId);
  if ("error" in loaded) {
    const status = loaded.error === "No open run" ? 409 : 404;
    return NextResponse.json({ message: loaded.error }, { status });
  }
  const { run, item } = loaded;

  const user = await prisma.user.findUnique({
    where: { id: auth.session.userId },
    select: { name: true },
  });
  if (!user) {
    // Session JWT references a user that no longer exists — e.g. the DB was reset
    // while the client still holds an old cookie. Return 401 so the client can
    // roll back its optimistic UI and prompt a re-login.
    return NextResponse.json({ error: "Session expired, please sign in again" }, { status: 401 });
  }

  const check = await prisma.itemCheck.upsert({
    where: { runId_itemId: { runId: run.id, itemId: item.id } },
    create: {
      runId: run.id,
      itemId: item.id,
      checkedById: auth.session.userId,
      labelSnapshot: item.label,
      categoryNameSnapshot: item.category.name,
    },
    update: {
      checkedById: auth.session.userId,
      checkedAt: new Date(),
      labelSnapshot: item.label,
      categoryNameSnapshot: item.category.name,
    },
  });

  await publishItemChecked({
    itemId: item.id,
    checkedById: auth.session.userId,
    checkedByName: user.name,
    checkedAt: check.checkedAt.toISOString(),
  });

  return NextResponse.json({ ok: true, check });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { itemId } = await params;
  const auth = await resolveAuth();
  if ("error" in auth) return auth.error;

  const loaded = await loadOpenRunAndItem(itemId, auth.multimediaMinistryId);
  if ("error" in loaded) {
    const status = loaded.error === "No open run" ? 409 : 404;
    return NextResponse.json({ message: loaded.error }, { status });
  }
  const { run, item } = loaded;

  await prisma.itemCheck
    .delete({ where: { runId_itemId: { runId: run.id, itemId: item.id } } })
    .catch(() => null); // idempotent — already unchecked is fine

  await publishItemUnchecked(item.id);
  return NextResponse.json({ ok: true });
}
