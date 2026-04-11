import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canToggleChecklistItem, type RoleSlug } from "@/lib/permissions";
import { getMultimediaMinistryId } from "@/lib/checklist";
import { ChecklistPublicClient } from "@/features/checklist/ChecklistPublicClient";

export const dynamic = "force-dynamic";

export default async function ChecklistPage() {
  const multimediaMinistryId = await getMultimediaMinistryId();
  if (!multimediaMinistryId) {
    return (
      <div className="checklist-root">
        <div className="cl-container">
          <div className="cl-empty">Multimedia ministry is not configured.</div>
        </div>
      </div>
    );
  }

  const template = await prisma.checklistTemplate.findUnique({
    where: { ministryId: multimediaMinistryId },
    include: {
      categories: {
        where: { archivedAt: null },
        orderBy: { sortOrder: "asc" },
        include: {
          items: {
            where: { archivedAt: null },
            orderBy: { sortOrder: "asc" },
          },
        },
      },
    },
  });

  const run = template
    ? await prisma.checklistRun.findFirst({
        where: { templateId: template.id, closedAt: null },
        orderBy: { startedAt: "desc" },
      })
    : null;

  const checks = run
    ? await prisma.itemCheck.findMany({
        where: { runId: run.id },
        include: { checkedBy: { select: { id: true, name: true } } },
      })
    : [];

  // Resolve whether the viewer can interact. Public render is fine with session === null.
  const session = await getServerSession(authOptions);
  const canCheck = session?.userId
    ? canToggleChecklistItem(
        (session.roleSlug ?? "user") as RoleSlug,
        session.ministryIds ?? [],
        multimediaMinistryId
      )
    : false;

  return (
    <ChecklistPublicClient
      template={template}
      run={run}
      initialChecks={checks.map((c) => ({
        id: c.id,
        itemId: c.itemId,
        checkedById: c.checkedById,
        checkedByName: c.checkedBy.name,
        checkedAt: c.checkedAt.toISOString(),
      }))}
      canCheck={canCheck}
      currentUserId={session?.userId ?? null}
      currentUserName={session?.user?.name ?? null}
    />
  );
}
